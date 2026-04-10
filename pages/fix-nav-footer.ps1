# fix-nav-footer.ps1
# Run from F:\sjfcross.github.io\pages\
#
# What it does:
#   1. Replaces the old navbar block with <div id="site-nav"></div>
#   2. Replaces the old footer block with <div id="site-footer"></div>
#   3. Adds <script src="../assets/js/components.js"></script> before </body>
#
# The actual nav/footer HTML lives in assets/js/components.js
# Future updates: edit components.js only, no need to re-run this script.
#
# Usage:
#   cd F:\sjfcross.github.io\pages
#   .\fix-nav-footer.ps1

$navPlaceholder    = '<div id="site-nav"></div>'
$footerPlaceholder = '<div id="site-footer"></div>'
$componentScript   = '<script src="../assets/js/components.js"></script>'

$files = Get-ChildItem -Path "." -Filter "*.html"
$fixed = 0
$skipped = @()

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.UTF8Encoding]::new($false))
    $original = $content
    $changed = $false

    # ── 1. Replace NAV block ──
    # Handles both "navbar-transparent" and "navbar-transparent " (trailing space variants)
    $navPattern = '(?s)<nav\s+class="navbar[^"]*navbar-transparent\s*".*?</nav>(\s*<!--\s*End Navbar\s*-->)?'
    if ($content -match $navPattern) {
        $content = [regex]::Replace($content, $navPattern, $navPlaceholder)
        $changed = $true
    }

    # ── 2. Replace FOOTER block ──
    $footerPattern = '(?s)<footer\s+class="footer[^"]*">.*?</footer>'
    if ($content -match $footerPattern) {
        $content = [regex]::Replace($content, $footerPattern, $footerPlaceholder)
        $changed = $true
    }

    # ── 3. Inject component script before </body> if not already there ──
    if ($changed -and $content -notmatch 'components\.js') {
        $content = $content -replace '(?i)</body>', "$componentScript`n</body>"
    }

    if ($changed) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "✓  $($file.Name)" -ForegroundColor Green
        $fixed++
    } else {
        $skipped += $file.Name
        Write-Host "~  $($file.Name)  (nothing matched)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "────────────────────────────────" -ForegroundColor Cyan
Write-Host "Fixed:   $fixed files" -ForegroundColor Green

if ($skipped.Count -gt 0) {
    Write-Host "Skipped: $($skipped.Count) files (check manually)" -ForegroundColor Yellow
    $skipped | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Copy components.js to F:\sjfcross.github.io\assets\js\" -ForegroundColor White
Write-Host "  2. git add ." -ForegroundColor White
Write-Host "  3. git commit -m 'Replace nav/footer with shared component'" -ForegroundColor White
Write-Host "  4. git push" -ForegroundColor White
