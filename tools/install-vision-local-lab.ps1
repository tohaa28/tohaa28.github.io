# Vision Check LAN laboratory installer
# Executes only on the PC where the user runs it. No network access.
# Requires the Python file in the same tools directory.
[CmdletBinding()]
param(
  [string]$Destination = 'D:\VisionCheckLab'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') {
  throw 'This setup is for Windows. Use vision_local_lab.py directly elsewhere.'
}
$targetDrive = [System.IO.Path]::GetPathRoot($Destination)
if (-not $targetDrive -or -not (Test-Path -LiteralPath $targetDrive)) {
  throw "Requested destination drive is unavailable: $targetDrive"
}
$base = [System.IO.Path]::GetFullPath($Destination)
if ($base -notlike 'D:\*') {
  throw 'For this test build, install only under D:\.'
}
$source = Join-Path $PSScriptRoot 'vision_local_lab.py'
if (-not (Test-Path -LiteralPath $source)) {
  throw "Missing vision_local_lab.py next to installer. Extract entire archive first."
}
$launcher = Get-Command 'py.exe' -ErrorAction SilentlyContinue
if (-not $launcher) {
  throw 'Python 3 launcher py.exe is required (install Python for Windows first).'
}
& py -3 --version
if ($LASTEXITCODE -ne 0) {
  throw 'Python 3 is not available via py -3.'
}
$paths = @('tools','incoming','samples','reports','quarantine','logs')
foreach ($part in $paths) {
  $dir = Join-Path $base $part
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
$installedPython = Join-Path $base 'tools\vision_local_lab.py'
Copy-Item -LiteralPath $source -Destination $installedPython -Force
foreach ($module in @('vision_roi_review.py', 'vision_pdf_audit.py')) {
  $moduleSource = Join-Path $PSScriptRoot $module
  if (-not (Test-Path -LiteralPath $moduleSource)) {
    throw "Required local review/audit module missing: $module"
  }
  Copy-Item -LiteralPath $moduleSource -Destination (Join-Path $base "tools\$module") -Force
}
& py -3 $installedPython init --root $base
if ($LASTEXITCODE -ne 0) {
  throw 'Python lab init failed.'
}
$start = @'
@echo off
cd /d "%~dp0"
py -3 "%~dp0tools\vision_local_lab.py" serve --root "%~dp0"
pause
'@
$import = @'
@echo off
if "%~1"=="" (
  echo Drag a vision-private-originals-part-0001.zip onto this file, or pass its path.
  pause
  exit /b 2
)
py -3 "%~dp0tools\vision_local_lab.py" import --root "%~dp0" --zip "%~1"
pause
'@
$report = @'
@echo off
py -3 "%~dp0tools\vision_local_lab.py" report --root "%~dp0"
pause
'@
[System.IO.File]::WriteAllText((Join-Path $base 'START-VISION-LAB.cmd'),$start,
  [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $base 'IMPORT-EXPERT-ZIP.cmd'),$import,
  [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $base 'REPORT-VISION-LAB.cmd'),$report,
  [System.Text.UTF8Encoding]::new($false))
$readme = @'
Vision Check — локальный исследовательский стенд
=============================================

1. Откройте http://psk.testgifts.local/devorders?status=140 в локальной сети.
2. Запустите закладку Vision Check — заказы.
3. Нажмите «Проверить все заказы» или «Проверить строку».
4. Отдельно подтвердите «Локальные примеры ZIP — все»: архивы будут
   создаваться последовательно по частям и НЕ отправятся в GitHub.
5. По очереди перетащите каждую загруженную ZIP-часть на IMPORT-EXPERT-ZIP.cmd.
6. Запустите START-VISION-LAB.cmd; сохранённые оригиналы не выдаются
   через localhost. Либо REPORT-VISION-LAB.cmd для отчёта.
7. Исследовательский PDF-аудит (только локально):
   py -3 tools\vision_pdf_audit.py --root D:\VisionCheckLab --sample-id ID
   PyMuPDF является НЕОБЯЗАТЕЛЬНОЙ внешней зависимостью, не устанавливается
   скриптом; проверьте условия AGPL/коммерческой лицензии самостоятельно.
8. Двойная независимая ROI-разметка:
   py -3 tools\vision_roi_review.py propose --root D:\VisionCheckLab ...
   py -3 tools\vision_roi_review.py vote --root D:\VisionCheckLab ...
   py -3 tools\vision_roi_review.py queue --root D:\VisionCheckLab
   Разногласия разрешаются третьим независимым экспертом (adjudicate).

Структура:
incoming/    — файлы, подготовленные вручную
samples/     — исходные тестовые SVG/PDF/bitmap, сохранённые локально
quarantine/  — промежуточные файлы импорта
reports/     — локальные отчёты
visionlab.sqlite3 — учёт SHA-256 и экспертных ROI
tools/vision_local_lab.py — автономное приложение Python (стандартная библиотека)
tools/vision_roi_review.py — независимая ROI-разметка, голоса и разбор конфликтов
tools/vision_pdf_audit.py — опциональный локальный PDF-аудит (без автодопуска)

НЕТ автоматического обучения. Метка строки — не подтверждённый дефект
конкретного объекта. Для качественного обучения нужны ROI, независимая
проверка технологом, подтверждение масштаба и family holdout.
Никакие макеты, данные заказов или cookies на GitHub не передаются.
Локальная панель доступна только на 127.0.0.1 с временным токеном.
'@
[System.IO.File]::WriteAllText((Join-Path $base 'README_RU.txt'),$readme,
  [System.Text.UTF8Encoding]::new($false))
Write-Host "Vision Check local research stand installed at: $base"
Write-Host "Start: $base\START-VISION-LAB.cmd"
Write-Host 'No remote downloads or code execution occurred.'
