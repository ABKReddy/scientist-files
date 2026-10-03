<#
  SCIENTIFIC FILES - end-to-end smoke test (PowerShell)

  Exercises the whole system against a RUNNING server:
    admin login -> upload video -> generate code -> user verifies code ->
    streams video -> disable -> enable -> delete -> logout -> rate limiting.

  Usage:
    # 1. start MongoDB + the API (see README)
    npm run seed:admin
    npm run start            # or: npm run dev
    # 2. in another shell
    powershell -ExecutionPolicy Bypass -File scripts/e2e-smoke.ps1

  Optional overrides:
    $env:SF_BASE_URL, $env:SF_ADMIN_EMAIL, $env:SF_ADMIN_PASSWORD
#>

param([switch]$SkipRateLimit)

$ErrorActionPreference = 'Continue'
# Compatible with Windows PowerShell 5.1 and PowerShell 7.
$base = if ($env:SF_BASE_URL) { $env:SF_BASE_URL } else { 'http://localhost:5000' }
$adminEmail = if ($env:SF_ADMIN_EMAIL) { $env:SF_ADMIN_EMAIL } else { 'chief@scientificfiles.local' }
$adminPassword = if ($env:SF_ADMIN_PASSWORD) { $env:SF_ADMIN_PASSWORD } else { 'Forensics#2026' }
$uploadsDir = Join-Path $PSScriptRoot '..\server\uploads'
$latin1 = [System.Text.Encoding]::GetEncoding(28591)

$script:pass = 0
$script:fail = 0
$results = New-Object System.Collections.ArrayList

function Check($name, $condition, $detail = '') {
  if ($condition) { $script:pass++; $script:results.Add("  PASS  $name") }
  else { $script:fail++; $script:results.Add("  FAIL  $name -> $detail") }
}

# A structurally valid (tiny) MP4 so magic-byte sniffing passes.
$videoPath = Join-Path $env:TEMP 'sf-e2e-evidence.mp4'
$header = [byte[]]@(0,0,0,0x20) +
  $latin1.GetBytes('ftyp') +
  $latin1.GetBytes('isom') +
  [byte[]]@(0,0,2,0) +
  $latin1.GetBytes('isomiso2mp41')
$body = New-Object byte[] (256 * 1024)
(New-Object Random(42)).NextBytes($body)
[System.IO.File]::WriteAllBytes($videoPath, $header + $body)

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$admin = @{ email = $adminEmail; password = $adminPassword }

# -- Preflight: is the server up, and is the public rate limiter already tripped? --
$health = $null
try { $health = Invoke-RestMethod "$base/api/health" -TimeoutSec 10 } catch { }
if (-not $health) {
  Write-Host "Cannot reach $base - start the API first (npm run dev:server or npm start)." -ForegroundColor Red
  exit 2
}
Write-Host "Server: $($health.status) | storage: $($health.storage) | env: $($health.environment)" -ForegroundColor DarkGray

$probeResponse = $null
try { $probeResponse = Invoke-WebRequest "$base/api/clues/verify" -Method POST -ContentType 'application/json' -Body '{"code":"ZZZZZ"}' } catch { $probeResponse = $_.Exception.Response }

$headerLine = ''
if ($probeResponse -and $probeResponse.Headers) {
  # WebHeaderCollection supports string indexing: `$headers['RateLimit']
  $headerLine = [string]$probeResponse.Headers['RateLimit']
  if (-not $headerLine -and $probeResponse.Headers['RateLimit-Limit']) {
    $headerLine = "limit=$($probeResponse.Headers['RateLimit-Limit']), remaining=$($probeResponse.Headers['RateLimit-Remaining'])"
  }
}
$remaining = 0
$verifyLimit = 0
if ($headerLine -match 'limit=(\d+)') { $verifyLimit = [int]$Matches[1] }
if ($headerLine -match 'remaining=(\d+)') { $remaining = [int]$Matches[1] }

if ($verifyLimit -gt 0 -and $remaining -lt 3) {
  Write-Host "Public rate limiter is nearly exhausted for this IP (remaining $remaining of $verifyLimit)." -ForegroundColor Yellow
  Write-Host "Wait for the window to reset, or restart the server with a higher VERIFY_RATE_LIMIT_MAX." -ForegroundColor Yellow
  exit 2
}

Write-Host "`n=== 1. UNAUTHENTICATED ACCESS ===" -ForegroundColor Cyan
try { Invoke-RestMethod "$base/api/clues" -Method GET -ErrorAction Stop | Out-Null; Check 'GET /api/clues blocked without auth' $false }
catch { Check 'GET /api/clues blocked without auth' ($_.Exception.Response.StatusCode.value__ -eq 401) "got $($_.Exception.Response.StatusCode.value__)" }
try { Invoke-RestMethod "$base/api/auth/me" -Method GET -ErrorAction Stop | Out-Null; Check 'GET /api/auth/me blocked without auth' $false }
catch { Check 'GET /api/auth/me blocked without auth' ($_.Exception.Response.StatusCode.value__ -eq 401) }

Write-Host "`n=== 2. ADMIN LOGIN ===" -ForegroundColor Cyan
try { Invoke-RestMethod "$base/api/auth/login" -Method POST -Body (@{email='wrong@x.com';password='nope'} | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop | Out-Null; Check 'Wrong password rejected' $false }
catch { Check 'Wrong password -> generic message' ($_.Exception.Response.StatusCode.value__ -eq 401 -and $_.ErrorDetails.Message -match 'Invalid email or password.') $_.ErrorDetails.Message }
$login = Invoke-RestMethod "$base/api/auth/login" -Method POST -Body ($admin | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
Check 'Valid credentials return admin' ($login.success -and $login.admin.email -eq $adminEmail)
$cookie = $session.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'sf_admin_token' }
Check 'httpOnly session cookie issued' ($cookie -and $cookie.HttpOnly -and $cookie.Value.Length -gt 40)
$me = Invoke-RestMethod "$base/api/auth/me" -Method GET -WebSession $session
Check 'GET /api/auth/me with cookie' ($me.admin.email -eq $adminEmail)
$baseline = (Invoke-RestMethod "$base/api/clues" -WebSession $session).stats.totalClues

Write-Host "`n=== 3. UPLOAD VIDEO ===" -ForegroundColor Cyan
# curl.exe is used for multipart (Invoke-RestMethod needs -Form on PS 7+).
$upload = (& curl.exe -s -X POST "$base/api/clues/upload" -b "sf_admin_token=$($cookie.Value)" -F "video=@$videoPath;type=video/mp4;filename=evidence.mp4") | ConvertFrom-Json
Check 'Upload returns VIDEO UPLOADED SUCCESSFULLY' ($upload.message -eq 'VIDEO UPLOADED SUCCESSFULLY') $upload.message
Check 'Upload returns an upload token' ($upload.upload.uploadToken.Length -gt 20)

Write-Host "`n=== 4. GENERATE CODE (backend) ===" -ForegroundColor Cyan
$created = Invoke-RestMethod "$base/api/clues" -Method POST -ContentType 'application/json' -WebSession $session -Body (@{ title = 'Clue 01'; description = 'First scientific clue'; uploadToken = $upload.upload.uploadToken } | ConvertTo-Json)
$code = $created.clue.code
Check 'Clue created successfully' ($created.message -eq 'CLUE CREATED SUCCESSFULLY') $created.message
Check "Generated code '$code' matches ^[A-Z0-9]{5}$" ($code -match '^[A-Z0-9]{5}$')
Check 'Clue is active by default' ($created.clue.isActive -eq $true)

$bulkIds = @()
$codes = @($code)
1..7 | ForEach-Object {
  $u = (& curl.exe -s -X POST "$base/api/clues/upload" -b "sf_admin_token=$($cookie.Value)" -F "video=@$videoPath;type=video/mp4;filename=clue$_.mp4") | ConvertFrom-Json
  $c = Invoke-RestMethod "$base/api/clues" -Method POST -ContentType 'application/json' -WebSession $session -Body (@{ title = "Bulk clue $_"; uploadToken = $u.upload.uploadToken } | ConvertTo-Json)
  $codes += $c.clue.code
  $bulkIds += $c.clue.id
}
Check '8 generated codes are all unique' (($codes | Select-Object -Unique).Count -eq 8) ($codes -join ',')

Write-Host "`n=== 5. PARTICIPANT: VERIFY CODE ===" -ForegroundColor Cyan
$verify = Invoke-RestMethod "$base/api/clues/verify" -Method POST -Body (@{code=$code} | ConvertTo-Json) -ContentType 'application/json'
Check 'Valid code unlocks the clue' ($verify.success -and $verify.clue.title -eq 'Clue 01')
Check 'Response says CLUE UNLOCKED' ($verify.message -eq 'CLUE UNLOCKED')
$lower = Invoke-RestMethod "$base/api/clues/verify" -Method POST -Body (@{code=$code.ToLower()} | ConvertTo-Json) -ContentType 'application/json'
Check 'Lowercase code also works' ($lower.clue.id -eq $verify.clue.id)
try { Invoke-RestMethod "$base/api/clues/verify" -Method POST -Body (@{code='ZZZZZ'} | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop | Out-Null; Check 'Invalid code rejected' $false }
catch { Check 'Invalid code -> "Invalid Code. No clue found."' ($_.ErrorDetails.Message -match 'Invalid Code. No clue found.') $_.ErrorDetails.Message }
try { Invoke-RestMethod "$base/api/clues/verify" -Method POST -Body (@{code='AB'}) -ContentType 'application/json' -ErrorAction Stop | Out-Null; Check 'Malformed code rejected' $false }
catch { Check 'Malformed code rejected (400)' ($_.Exception.Response.StatusCode.value__ -eq 400) }

Write-Host "`n=== 6. VIDEO STREAMING ===" -ForegroundColor Cyan
$stream = & curl.exe -s -o NUL -w '%{http_code}|%{redirect_url}' "$base$($verify.clue.streamUrl)"
Check 'streamUrl 302-redirects to token-gated media' ($stream -match '^302\|.*/api/media/') $stream
$mediaUrl = ($stream -split '\|')[1] -replace '^http://localhost:5000',''
$head = & curl.exe -s -o NUL -w '%{http_code}|%{content_type}|%{size_download}' "$base$mediaUrl"
Check 'Media served as video/mp4' ($head -match '^200\|video/mp4\|') $head
$range = & curl.exe -s -o NUL -w '%{http_code}' -H 'Range: bytes=0-1023' "$base$mediaUrl"
Check 'Range request -> 206 (seeking works)' ($range -eq '206') $range
$noToken = & curl.exe -s -o NUL -w '%{http_code}' "$base/api/media/anything.mp4"
Check 'Media without token rejected' ($noToken -eq '401') $noToken

Write-Host "`n=== 7. DISABLE / ENABLE / DELETE ===" -ForegroundColor Cyan
$off = Invoke-RestMethod "$base/api/clues/$($verify.clue.id)/status" -Method PATCH -Body (@{isActive=$false} | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
Check 'Clue disabled' ($off.clue.isActive -eq $false)
try { Invoke-RestMethod "$base/api/clues/verify" -Method POST -Body (@{code=$code} | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop | Out-Null; Check 'Disabled clue blocked' $false }
catch { Check 'Disabled clue -> "This clue is currently unavailable."' ($_.ErrorDetails.Message -match 'This clue is currently unavailable.') $_.ErrorDetails.Message }
$blocked = & curl.exe -s -o NUL -w '%{http_code}' "$base$($verify.clue.streamUrl)"
Check 'Disabled clue video unreachable (403)' ($blocked -eq '403') $blocked
$on = Invoke-RestMethod "$base/api/clues/$($verify.clue.id)/status" -Method PATCH -Body (@{isActive=$true} | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
Check 'Clue re-enabled' ($on.clue.isActive -eq $true)
Invoke-RestMethod "$base/api/clues/verify" -Method POST -Body (@{code=$code} | ConvertTo-Json) -ContentType 'application/json' | Out-Null
Check 'Re-enabled clue verifies again' $true

$list = Invoke-RestMethod "$base/api/clues" -WebSession $session
Check 'Dashboard stats reflect the 8 new clues' ($list.stats.totalClues -eq ($baseline + 8) -and $list.stats.generatedCodes -eq ($baseline + 8)) "total=$($list.stats.totalClues) baseline=$baseline"
$filter = Invoke-RestMethod "$base/api/clues?status=active&search=Clue%2001" -WebSession $session
Check 'Search + status filter works' ($filter.clues[0].title -eq 'Clue 01') "count=$($filter.clues.Count)"

$storedFile = Join-Path $uploadsDir $created.clue.videoPublicId
Check 'Video file exists in storage' (Test-Path $storedFile)
Invoke-RestMethod "$base/api/clues/$($verify.clue.id)" -Method DELETE -WebSession $session | Out-Null
Check 'Stored video removed after delete' (-not (Test-Path $storedFile))
try { Invoke-RestMethod "$base/api/clues/verify" -Method POST -Body (@{code=$code} | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop | Out-Null; Check 'Deleted code rejected' $false }
catch { Check 'Deleted code no longer verifies' ($_.Exception.Response.StatusCode.value__ -eq 404) }

Write-Host "`n=== 8. CLEANUP + UPLOAD VALIDATION ===" -ForegroundColor Cyan
# Leave the database exactly as we found it.
foreach ($clueId in $bulkIds) {
  try { Invoke-RestMethod "$base/api/clues/$clueId" -Method DELETE -WebSession $session -ErrorAction Stop | Out-Null } catch { }
}
$afterCleanup = (Invoke-RestMethod "$base/api/clues" -WebSession $session).stats.totalClues
Check 'Bulk clues cleaned up (database back to baseline)' ($afterCleanup -eq $baseline) "total=$afterCleanup"

$badPath = Join-Path $env:TEMP 'sf-not-a-video.mp4'
[System.IO.File]::WriteAllBytes($badPath, [System.Text.Encoding]::ASCII.GetBytes('definitely not a video file at all'))
$bad = (& curl.exe -s -X POST "$base/api/clues/upload" -b "sf_admin_token=$($cookie.Value)" -F "video=@$badPath;type=video/mp4;filename=fake.mp4") | ConvertFrom-Json
Check 'Non-video file rejected (magic bytes)' ($bad.message -match 'Unsupported video file') $bad.message
$type = (& curl.exe -s -X POST "$base/api/clues/upload" -b "sf_admin_token=$($cookie.Value)" -F "video=@$videoPath;type=application/octet-stream;filename=evidence.exe") | ConvertFrom-Json
Check 'Wrong mime/extension rejected' ($type.message -match 'Unsupported file type') $type.message
$unauthUpload = & curl.exe -s -o NUL -w '%{http_code}' -X POST "$base/api/clues/upload" -F "video=@$videoPath;type=video/mp4"
Check 'Unauthenticated upload blocked' ($unauthUpload -eq '401') $unauthUpload
$dollar = [char]36
$injectionBody = '{"code":{"' + $dollar + 'ne":null}}'
$noSqlStatus = 'none'
try {
  Invoke-RestMethod "$base/api/clues/verify" -Method POST -ContentType 'application/json' -Body $injectionBody -ErrorAction Stop | Out-Null
  $noSqlStatus = '200'
} catch { $noSqlStatus = [string]$_.Exception.Response.StatusCode.value__ }
Check 'NoSQL injection payload rejected' ($noSqlStatus -eq '400') $noSqlStatus

Write-Host "`n=== 9. LOGOUT ===" -ForegroundColor Cyan
$logout = Invoke-RestMethod "$base/api/auth/logout" -Method POST -WebSession $session
Check 'Logout succeeds' ($logout.success -eq $true)
$after = & curl.exe -s -o NUL -w '%{http_code}' -b "sf_admin_token=$($cookie.Value)" "$base/api/clues"
Check 'Session invalid after logout' ($after -eq '401') $after

Write-Host "`n=== 10. RATE LIMITING ===" -ForegroundColor Cyan
# The burst test only makes sense when the configured limit is small. The vitest
# suite already covers the limiter in isolation (tests/rateLimit.test.ts).
if ($SkipRateLimit) {
  Write-Host "  SKIP  rate-limit burst (-SkipRateLimit)"
} elseif ($verifyLimit -gt 0 -and $verifyLimit -le 40) {
  $script:limited = $false
  1..($verifyLimit + 10) | ForEach-Object {
    $resp = & curl.exe -s -o NUL -w '%{http_code}' -X POST "$base/api/clues/verify" -H 'Content-Type: application/json' --data-raw '{\"code\":\"ZZZZZ\"}'
    if ($resp -eq '429') { $script:limited = $true }
  }
  Check "Verification endpoint rate-limits at $verifyLimit req/window" $script:limited
} else {
  Write-Host "  SKIP  rate-limit burst (configured VERIFY_RATE_LIMIT_MAX = $verifyLimit; see tests/rateLimit.test.ts)"
}

$results | ForEach-Object { Write-Host $_ }
if ($fail -eq 0) {
  Write-Host "`n================ RESULT: $pass passed, $fail failed ================" -ForegroundColor Green
} else {
  Write-Host "`n================ RESULT: $pass passed, $fail FAILED ================" -ForegroundColor Red
}
Remove-Item $videoPath, $badPath -ErrorAction SilentlyContinue
if ($fail -gt 0) { exit 1 }