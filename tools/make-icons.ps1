# Generates the app icons with System.Drawing.
# This machine had no Node or Python image library when the app was started, and
# PowerShell is always here, so the icons are built rather than committed by hand.
#
#   powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }

$sizes = 192, 512, 180

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Full-bleed background: a maskable icon gets cropped to a circle on some
    # launchers, so nothing important may sit near the edge.
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 38, 59))
    $g.FillRectangle($bg, 0, 0, $size, $size)

    # Accent bar across the lower third.
    $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(29, 111, 208))
    $barH = [int]($size * 0.075)
    $barW = [int]($size * 0.34)
    $g.FillRectangle($accent, [int](($size - $barW) / 2), [int]($size * 0.655), $barW, $barH)

    # "SIA" wordmark, kept inside the central 80% safe zone.
    $fontSize = [float]($size * 0.30)
    $font = New-Object System.Drawing.Font('Segoe UI', $fontSize,
        [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, [float]($size * -0.06), [float]$size, [float]$size)
    $g.DrawString('SIA', $font, $white, $rect, $fmt)

    $path = Join-Path $outDir ("icon-{0}.png" -f $size)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

    $font.Dispose(); $white.Dispose(); $accent.Dispose(); $bg.Dispose()
    $g.Dispose(); $bmp.Dispose()
    Write-Host "wrote $path"
}
