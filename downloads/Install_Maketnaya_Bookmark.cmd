@echo off
setlocal
chcp 65001 >nul
set "SELF=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8); $m='### POWERSHELL ###'; $i=$t.IndexOf($m); if($i -lt 0){throw 'PowerShell section not found'}; Invoke-Expression $t.Substring($i+$m.Length)"
exit /b

### POWERSHELL ###
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$title = 'Макетная'
$bookmarkUrl = @'
javascript:(()=>{const s=document.createElement('script');s.src='https://tohaa28.github.io/gifts-layout-workbench/launcher.js?v='+Date.now();document.documentElement.appendChild(s)})()
'@.Trim()

function Pause-And-Exit([string]$message, [int]$code = 0) {
    Write-Host ''
    Write-Host $message
    Write-Host ''
    [void](Read-Host 'Нажмите Enter для закрытия')
    exit $code
}

function Get-DefaultProgId {
    try {
        return [string](Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' -ErrorAction Stop).ProgId
    } catch {
        return ''
    }
}

function Get-BrowserCandidates {
    $items = @(
        [pscustomobject]@{ Name='Google Chrome'; Match='ChromeHTML'; Process='chrome'; Root=(Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'); DirectProfile=$false },
        [pscustomobject]@{ Name='Microsoft Edge'; Match='MSEdgeHTM'; Process='msedge'; Root=(Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'); DirectProfile=$false },
        [pscustomobject]@{ Name='Brave'; Match='BraveHTML'; Process='brave'; Root=(Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\User Data'); DirectProfile=$false },
        [pscustomobject]@{ Name='Yandex Browser'; Match='Yandex'; Process='browser'; Root=(Join-Path $env:LOCALAPPDATA 'Yandex\YandexBrowser\User Data'); DirectProfile=$false },
        [pscustomobject]@{ Name='Opera'; Match='Opera'; Process='opera'; Root=(Join-Path $env:APPDATA 'Opera Software\Opera Stable'); DirectProfile=$true }
    )
    return @($items | Where-Object { Test-Path $_.Root })
}

function Select-Browser {
    $installed = @(Get-BrowserCandidates)
    if ($installed.Count -eq 0) { return $null }

    $progId = Get-DefaultProgId
    foreach ($b in $installed) {
        if ($progId -and $progId -match [regex]::Escape($b.Match)) { return $b }
    }

    foreach ($preferred in @('Google Chrome','Microsoft Edge','Yandex Browser','Brave','Opera')) {
        $b = $installed | Where-Object Name -eq $preferred | Select-Object -First 1
        if ($b) { return $b }
    }
    return $installed[0]
}

function Get-BookmarkFiles($browser) {
    $result = @()

    if ($browser.DirectProfile) {
        $p = Join-Path $browser.Root 'Bookmarks'
        if (Test-Path $p) { $result += $p }
        return $result
    }

    $dirs = Get-ChildItem -LiteralPath $browser.Root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$' }

    foreach ($d in $dirs) {
        $p = Join-Path $d.FullName 'Bookmarks'
        if (Test-Path $p) { $result += $p }
    }

    return @($result)
}

function Get-NodeIds($node) {
    if ($null -eq $node) { return }
    if ($node.PSObject -and $node.PSObject.Properties['id']) {
        $v = [string]$node.id
        if ($v -match '^\d+$') { [Int64]$v }
    }
    if ($node.PSObject -and $node.PSObject.Properties['children'] -and $null -ne $node.children) {
        foreach ($child in @($node.children)) { Get-NodeIds $child }
    }
}

function Get-ChromeTime {
    $unixMicros = [Int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) * 1000L
    return ($unixMicros + 11644473600000000L).ToString()
}

function Set-Property($obj, [string]$name, $value) {
    if ($obj.PSObject.Properties[$name]) { $obj.$name = $value }
    else { $obj | Add-Member -MemberType NoteProperty -Name $name -Value $value }
}

function Set-Checksums($data) {
    $stream = New-Object System.IO.MemoryStream
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $utf16 = New-Object System.Text.UnicodeEncoding($false, $false)

    function Add-Utf8([string]$s) {
        $bytes = $utf8.GetBytes($s)
        $stream.Write($bytes, 0, $bytes.Length)
    }
    function Add-Utf16([string]$s) {
        $bytes = $utf16.GetBytes($s)
        $stream.Write($bytes, 0, $bytes.Length)
    }
    function Add-Node($node) {
        if ($null -eq $node) { return }
        $id = [string]$node.id
        $name = [string]$node.name
        $type = [string]$node.type

        Add-Utf8 $id
        Add-Utf16 $name
        Add-Utf8 $type

        if ($type -eq 'url') {
            Add-Utf8 ([string]$node.url)
        } elseif ($type -eq 'folder') {
            foreach ($child in @($node.children)) { Add-Node $child }
        }
    }

    foreach ($rootName in @('bookmark_bar','other','synced')) {
        $p = $data.roots.PSObject.Properties[$rootName]
        if (-not $p) { throw "В Bookmarks отсутствует корень $rootName" }
        Add-Node $p.Value
    }

    $bytes = $stream.ToArray()
    $stream.Dispose()

    $md5 = [System.Security.Cryptography.MD5]::Create()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $md5Hex = (($md5.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
        $shaHex = (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
    } finally {
        $md5.Dispose()
        $sha.Dispose()
    }

    Set-Property $data 'checksum' $md5Hex
    Set-Property $data 'checksum_sha256' $shaHex
}

function Install-Bookmark([string]$bookmarksPath) {
    $profileDir = Split-Path $bookmarksPath -Parent
    $profileName = Split-Path $profileDir -Leaf

    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupPath = "$bookmarksPath.MaketnayaBackup_$timestamp"
    Copy-Item -LiteralPath $bookmarksPath -Destination $backupPath -Force

    $data = Get-Content -Raw -LiteralPath $bookmarksPath -Encoding UTF8 | ConvertFrom-Json
    if (-not $data.roots -or -not $data.roots.bookmark_bar) {
        throw "Некорректный файл Bookmarks: $bookmarksPath"
    }

    $bar = $data.roots.bookmark_bar
    $children = @($bar.children)

    $existing = $children | Where-Object {
        $_.type -eq 'url' -and $_.name -eq $title
    } | Select-Object -First 1

    if ($existing) {
        $existing.name = $title
        $existing.url = $bookmarkUrl
        $action = 'обновлена'
    } else {
        $ids = @()
        foreach ($rootProp in $data.roots.PSObject.Properties) {
            $ids += @(Get-NodeIds $rootProp.Value)
        }

        $maxId = 0L
        if ($ids.Count -gt 0) {
            $maximum = ($ids | Measure-Object -Maximum).Maximum
            if ($null -ne $maximum) { $maxId = [Int64]$maximum }
        }

        $now = Get-ChromeTime
        $item = [pscustomobject][ordered]@{
            date_added     = $now
            date_last_used = '0'
            guid           = ([guid]::NewGuid().ToString().ToLowerInvariant())
            id             = ([Int64]($maxId + 1)).ToString()
            name           = $title
            type           = 'url'
            url            = $bookmarkUrl
        }

        $bar.children = @($children + $item)
        if ($bar.PSObject.Properties['date_modified']) { $bar.date_modified = $now }
        $action = 'добавлена'
    }

    Set-Checksums $data

    $json = $data | ConvertTo-Json -Depth 100 -Compress
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $tempPath = "$bookmarksPath.MaketnayaTemp"
    [System.IO.File]::WriteAllText($tempPath, $json, $utf8NoBom)

    # Проверяем временный JSON до замены рабочего файла.
    $check = Get-Content -Raw -LiteralPath $tempPath -Encoding UTF8 | ConvertFrom-Json
    $found = @($check.roots.bookmark_bar.children) | Where-Object {
        $_.type -eq 'url' -and $_.name -eq $title -and $_.url -eq $bookmarkUrl
    } | Select-Object -First 1
    if (-not $found) {
        Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
        throw "Проверка записи не пройдена для профиля $profileName"
    }

    Move-Item -LiteralPath $tempPath -Destination $bookmarksPath -Force

    # Повторная проверка уже рабочего файла.
    $verify = Get-Content -Raw -LiteralPath $bookmarksPath -Encoding UTF8 | ConvertFrom-Json
    $verified = @($verify.roots.bookmark_bar.children) | Where-Object {
        $_.type -eq 'url' -and $_.name -eq $title -and $_.url -eq $bookmarkUrl
    } | Select-Object -First 1
    if (-not $verified) {
        throw "Закладка не обнаружена после записи в профиль $profileName"
    }

    return [pscustomobject]@{
        Profile = $profileName
        Action = $action
        Backup = $backupPath
    }
}

try {
    Write-Host ''
    Write-Host 'Установка закладки "Макетная"' -ForegroundColor Cyan
    Write-Host '--------------------------------'
    Write-Host ''

    $browser = Select-Browser
    if ($null -eq $browser) {
        Pause-And-Exit 'Не найден поддерживаемый Chromium-браузер (Chrome, Edge, Brave, Yandex Browser или Opera).' 1
    }

    Write-Host ("Браузер: {0}" -f $browser.Name)
    Write-Host ("Код закладки: {0}" -f $bookmarkUrl)
    Write-Host ''

    while (Get-Process -Name $browser.Process -ErrorAction SilentlyContinue) {
        Write-Host ("Полностью закройте {0}. Он всё ещё работает в фоне." -f $browser.Name) -ForegroundColor Yellow
        [void](Read-Host 'После закрытия браузера нажмите Enter')
    }

    $files = @(Get-BookmarkFiles $browser)
    if ($files.Count -eq 0) {
        Pause-And-Exit 'Файлы Bookmarks не найдены. Запустите браузер один раз, создайте любую обычную закладку, полностью закройте браузер и повторите установку.' 1
    }

    $success = 0
    foreach ($file in $files) {
        try {
            $r = Install-Bookmark $file
            $success++
            Write-Host ("Профиль {0}: закладка {1}." -f $r.Profile, $r.Action) -ForegroundColor Green
        } catch {
            Write-Host ("Ошибка профиля {0}: {1}" -f (Split-Path (Split-Path $file -Parent) -Leaf), $_.Exception.Message) -ForegroundColor Red
        }
    }

    Write-Host ''
    if ($success -eq 0) {
        Pause-And-Exit 'Не удалось изменить ни один профиль браузера.' 1
    }

    Write-Host ("Готово: успешно обработано профилей — {0}." -f $success) -ForegroundColor Green
    Write-Host 'После запуска браузера включите панель закладок сочетанием Ctrl+Shift+B, если она скрыта.'
    Write-Host 'Закладка "Макетная" должна находиться непосредственно на панели закладок.'
    Pause-And-Exit 'Установка завершена.' 0
}
catch {
    Write-Host ''
    Write-Host 'Ошибка установки:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Pause-And-Exit 'Изменения не завершены.' 1
}
