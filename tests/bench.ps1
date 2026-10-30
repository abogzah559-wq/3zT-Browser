# Memory comparison: 3zT vs Google Chrome vs Brave (Windows).
# Each browser: its own new profile, the same 3 websites in 3 tabs, measured 30 s and 60 s after the last tab opened,
# two rounds in opposite order, averaged.
# Sums every process of the browser. Writes tests/out/bench.json and bench.md.
param([string]$ZtExe = "$PSScriptRoot\..\dist\3zT\3zT.exe")
$ErrorActionPreference = 'Continue'
$out = Join-Path $PSScriptRoot 'out'; New-Item -ItemType Directory -Force $out | Out-Null
$sites = @('https://en.wikipedia.org/wiki/Web_browser', 'https://github.com/electron/electron', 'https://stackoverflow.com/questions')

function Measure-Browser([string]$procName) {
  $p = Get-Process -Name $procName -ErrorAction SilentlyContinue
  [pscustomobject]@{
    processes = @($p).Count
    workingSetMB = [math]::Round((($p | Measure-Object WorkingSet64 -Sum).Sum) / 1MB)
    privateMB = [math]::Round((($p | Measure-Object PrivateMemorySize64 -Sum).Sum) / 1MB)
  }
}
function Run-One([string]$label, [string]$exe, [string]$procName, [scriptblock]$open) {
  if (-not (Test-Path $exe)) { Write-Host "skip $label (not found: $exe)"; return $null }
  Get-Process -Name $procName -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
  & $open
  Start-Sleep 30; $a = Measure-Browser $procName
  Start-Sleep 30; $b = Measure-Browser $procName
  Get-Process -Name $procName -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
  $r = [pscustomobject]@{ browser = $label; processes = $b.processes
    workingSetMB = [math]::Round(($a.workingSetMB + $b.workingSetMB) / 2); privateMB = [math]::Round(($a.privateMB + $b.privateMB) / 2) }
  Write-Host ($r | Format-List | Out-String); return $r
}

$tmp = Join-Path $env:RUNNER_TEMP 'bench'; New-Item -ItemType Directory -Force $tmp | Out-Null
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$brave = @("$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$common = @('--no-first-run', '--no-default-browser-check', '--disable-sync')

$runs = @{
  '3zT' = { Run-One '3zT' $ZtExe '3zT' { Remove-Item -Recurse -Force "$env:APPDATA\3zT Browser" -ErrorAction SilentlyContinue; Start-Process $ZtExe -ArgumentList @($sites[0]); Start-Sleep 8; foreach ($s in $sites[1..2]) { Start-Process $ZtExe -ArgumentList @($s); Start-Sleep 4 } } }
  'Google Chrome' = { if ($chrome) { Run-One 'Google Chrome' $chrome 'chrome' { Start-Process $chrome -ArgumentList ($common + @("--user-data-dir=$tmp\chrome$round") + $sites) } } }
  'Brave' = { if ($brave) { Run-One 'Brave' $brave 'brave' { Start-Process $brave -ArgumentList ($common + @("--user-data-dir=$tmp\brave$round") + $sites) } } }
}
# two rounds in opposite order, so neither browser always goes first; a new profile for every run
$all = @()
$round = 0
foreach ($order in @(@('3zT', 'Google Chrome', 'Brave'), @('Brave', 'Google Chrome', '3zT'))) { $round++; foreach ($n in $order) { $all += & $runs[$n] } }
$results = @()
foreach ($g in ($all | Where-Object { $_ } | Group-Object browser)) {
  $results += [pscustomobject]@{ browser = $g.Name; processes = [math]::Round(($g.Group | Measure-Object processes -Average).Average)
    workingSetMB = [math]::Round(($g.Group | Measure-Object workingSetMB -Average).Average); privateMB = [math]::Round(($g.Group | Measure-Object privateMB -Average).Average) }
}
$results = $results | Where-Object { $_ } | Sort-Object { @('3zT', 'Google Chrome', 'Brave').IndexOf($_.browser) }
$results | ConvertTo-Json | Set-Content (Join-Path $out 'bench.json')
$md = "| Browser | Processes | Memory (working set) | Memory (private) |`n|---|---|---|---|`n"
foreach ($r in $results) { $md += "| $($r.browser) | $($r.processes) | $($r.workingSetMB) MB | $($r.privateMB) MB |`n" }
$md | Set-Content (Join-Path $out 'bench.md'); Write-Host $md
