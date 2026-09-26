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
javascript:(()=>{const s=document.createElement('script');s.src='https://tohaa28.github.io/gifts-layout-workbench/launcher.js?v=%27+Date.now();document.documentElement.appendChild(s)})()
'@.Trim()

function Pause-And-Exit([string]$message, [int]$code = 0) {
    Write-Host ''
    Write-Host $message
    Write-Host ''
    [void](Read-Host 'Нажмите Enter для закрытия')
    exit $code
}

function Get-DefaultBrowserInfo {
    $progId = $null
    try {
        $uc = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' -ErrorAction SilentlyContinue
        $progId = [string]$uc.ProgId
    } catch {}

    $chromeData = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
    $edgeData   = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'

    if ($progId -match 'ChromeHTML' -and (Test-Path $chromeData)) {
        return [pscustomobject]@{ Name='Google Chrome'; Process='chrome'; UserData=$chromeData }
    }
    if ($progId -match 'MSEdgeHTM' -and (Test-Path $edgeData)) {
        return [pscustomobject]@{ Name='Microsoft Edge'; Process='msedge'; UserData=$edgeData }
    }

    if (Test-Path $chromeData) {
        return [pscustomobject]@{ Name='Google Chrome'; Process='chrome'; UserData=$chromeData }
    }
    if (Test-Path $edgeData) {
        return [pscustomobject]@{ Name='Microsoft Edge'; Process='msedge'; UserData=$edgeData }
    }

    return $null
}

function Get-LastProfile([string]$userData) {
    $localStatePath = Join-Path $userData 'Local State'
    if (Test-Path $localStatePath) {
        try {
            $localState = Get-Content -Raw -LiteralPath $localStatePath -Encoding UTF8 | ConvertFrom-Json
            if ($localState.profile.last_used) {
                return [string]$localState.profile.last_used
            }
        } catch {}
    }
    return 'Default'
}

function Get-NodeIds($node) {
    if ($null -eq $node) { return }

    if ($node.PSObject -and $node.PSObject.Properties['id']) {
        $v = [string]$node.id
        if ($v -match '^\d+$') {
            [Int64]$v
        }
    }

    if ($node.PSObject -and $node.PSObject.Properties['children'] -and $null -ne $node.children) {
        foreach ($child in @($node.children)) {
            Get-NodeIds $child
        }
    }
}

function Get-ChromeTime {
    $unixMicros = [Int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) * 1000L
    return ($unixMicros + 11644473600000000L).ToString()
}

function Set-Property($obj, [string]$name, $value) {
    if ($obj.PSObject.Properties[$name]) {
        $obj.$name = $value
    } else {
        $obj | Add-Member -MemberType NoteProperty -Name $name -Value $value
    }
}

function Update-Checksums($data) {
    $ms = New-Object System.IO.MemoryStream
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $utf16 = New-Object System.Text.UnicodeEncoding($false, $false)

    function Write-Utf8([string]$s) {
        $b = $utf8.GetBytes($s)
        $ms.Write($b, 0, $b.Length)
    }

    function Write-Utf16([string]$s) {
        $b = $utf16.GetBytes($s)
        $ms.Write($b, 0, $b.Length)
    }

    function Add-NodeChecksum($node) {
        if ($null -eq $node) { return }

        $id   = [string]$node.id
        $name = [string]$node.name
        $type = [string]$node.type

        Write-Utf8 $id
        Write-Utf16 $name
        Write-Utf8 $type

        if ($type -eq 'url') {
            Write-Utf8 ([string]$node.url)
        } elseif ($type -eq 'folder') {
            foreach ($child in @($node.children)) {
                Add-NodeChecksum $child
            }
        }
    }

    foreach ($rootName in @('bookmark_bar', 'other', 'synced')) {
        $prop = $data.roots.PSObject.Properties[$rootName]
        if ($prop) {
            Add-NodeChecksum $prop.Value
        }
    }

    $bytes = $ms.ToArray()
    $ms.Dispose()

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

try {
    Write-Host ''
    Write-Host 'Установка закладки "Макетная"' -ForegroundColor Cyan
    Write-Host '--------------------------------'
    Write-Host ''

    $browser = Get-DefaultBrowserInfo
    if ($null -eq $browser) {
        Pause-And-Exit 'Не найден Google Chrome или Microsoft Edge.' 1
    }

    Write-Host ("Браузер: {0}" -f $browser.Name)

    while (Get-Process -Name $browser.Process -ErrorAction SilentlyContinue) {
        Write-Host ''
        Write-Host ("Закройте {0}, чтобы он не перезаписал файл закладок." -f $browser.Name) -ForegroundColor Yellow
        [void](Read-Host 'После закрытия браузера нажмите Enter')
    }

    $profile = Get-LastProfile $browser.UserData
    $bookmarksPath = Join-Path (Join-Path $browser.UserData $profile) 'Bookmarks'

    if (-not (Test-Path $bookmarksPath)) {
        $candidates = Get-ChildItem -LiteralPath $browser.UserData -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$' } |
            ForEach-Object {
                $p = Join-Path $_.FullName 'Bookmarks'
                if (Test-Path $p) { $p }
            }

        if ($candidates.Count -gt 0) {
            $bookmarksPath = $candidates[0]
            $profile = Split-Path (Split-Path $bookmarksPath -Parent) -Leaf
        } else {
            Pause-And-Exit 'Файл Bookmarks не найден. Один раз запустите браузер, затем повторите установку.' 1
        }
    }

    Write-Host ("Профиль: {0}" -f $profile)

    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupPath = "$bookmarksPath.MaketnayaBackup_$timestamp"
    Copy-Item -LiteralPath $bookmarksPath -Destination $backupPath -Force

    $bakPath = "$bookmarksPath.bak"
    if (Test-Path $bakPath) {
        Copy-Item -LiteralPath $bakPath -Destination "$bakPath.MaketnayaBackup_$timestamp" -Force
    }

    $data = Get-Content -Raw -LiteralPath $bookmarksPath -Encoding UTF8 | ConvertFrom-Json

    if (-not $data.roots -or -not $data.roots.bookmark_bar) {
        throw 'В файле Bookmarks отсутствует корень bookmark_bar.'
    }

    $bar = $data.roots.bookmark_bar
    $children = @($bar.children)

    $existing = $children | Where-Object {
        $_.type -eq 'url' -and ($_.name -eq $title -or $_.url -eq $bookmarkUrl)
    } | Select-Object -First 1

    if ($existing) {
        $existing.name = $title
        $existing.url = $bookmarkUrl
        Write-Host 'Существующая закладка обновлена.'
    } else {
        $ids = @()
        foreach ($rootProp in $data.roots.PSObject.Properties) {
            $ids += @(Get-NodeIds $rootProp.Value)
        }

        $maxId = 0L
        if ($ids.Count -gt 0) {
            $m = ($ids | Measure-Object -Maximum).Maximum
            if ($null -ne $m) { $maxId = [Int64]$m }
        }

        $now = Get-ChromeTime
        $item = [pscustomobject][ordered]@{
            date_added    = $now
            date_last_used = '0'
            guid          = ([guid]::NewGuid().ToString().ToLowerInvariant())
            id            = ([Int64]($maxId + 1)).ToString()
            name          = $title
            type          = 'url'
            url           = $bookmarkUrl
        }

        $bar.children = @($children + $item)
        if ($bar.PSObject.Properties['date_modified']) {
            $bar.date_modified = $now
        }

        Write-Host 'Новая закладка добавлена.'
    }

    Update-Checksums $data

    $json = $data | ConvertTo-Json -Depth 100 -Compress
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($bookmarksPath, $json, $utf8NoBom)

    Write-Host ''
    Write-Host 'Готово.' -ForegroundColor Green
    Write-Host ('Закладка: {0}' -f $title)
    Write-Host ('Файл: {0}' -f $bookmarksPath)
    Write-Host ('Резервная копия: {0}' -f $backupPath)
    Write-Host ''
    Write-Host 'Теперь можно запустить браузер. Закладка находится на панели закладок.'
    Pause-And-Exit 'Установка завершена.' 0
}
catch {
    Write-Host ''
    Write-Host 'Ошибка установки:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Pause-And-Exit 'Исходный файл Bookmarks не удалялся; перед изменением создаётся резервная копия.' 1
}
