# Generates simple gradient placeholder images so the site builds and runs
# locally before real photography is supplied. Replace the files in
# src/assets with real, licensed/consented photos before going live.

Add-Type -AssemblyName System.Drawing

function New-GradientJpg {
    param(
        [string]$Path,
        [int]$Width,
        [int]$Height,
        [string]$TopColor,
        [string]$BottomColor,
        [string]$Label
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $c1 = [System.Drawing.ColorTranslator]::FromHtml($TopColor)
    $c2 = [System.Drawing.ColorTranslator]::FromHtml($BottomColor)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 60)
    $g.FillRectangle($brush, $rect)

    # Faint concentric ripple rings for texture
    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(28, 255, 255, 255), 2)
    $cx = $Width * 0.5
    $cy = $Height * 0.4
    for ($r = 40; $r -lt [Math]::Max($Width, $Height); $r += 90) {
        $g.DrawEllipse($ringPen, $cx - $r, $cy - $r, $r * 2, $r * 2)
    }

    if ($Label) {
        $font = New-Object System.Drawing.Font("Segoe UI", [Math]::Max(14, $Width / 22), [System.Drawing.FontStyle]::Regular)
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 255, 255, 255))
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString($Label, $font, $textBrush, (New-Object System.Drawing.RectangleF(0, 0, $Width, $Height)), $sf)
    }

    $g.Dispose()

    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 85L)
    $bmp.Save($Path, $encoder, $params)
    $bmp.Dispose()

    Write-Host "Wrote $Path"
}

$assets = Join-Path $PSScriptRoot "..\src\assets"
New-Item -ItemType Directory -Force -Path $assets | Out-Null

New-GradientJpg -Path (Join-Path $assets "hero-ripple.jpg") -Width 1920 -Height 1088 `
    -TopColor "#0d0d16" -BottomColor "#1a1420" -Label "PLACEHOLDER — hero-ripple"

New-GradientJpg -Path (Join-Path $assets "therapist-1.jpg") -Width 768 -Height 1024 `
    -TopColor "#241b2e" -BottomColor "#120f16" -Label "PLACEHOLDER`n愛妮"

New-GradientJpg -Path (Join-Path $assets "therapist-2.jpg") -Width 768 -Height 1024 `
    -TopColor "#20232e" -BottomColor "#101216" -Label "PLACEHOLDER`n夜微"

New-GradientJpg -Path (Join-Path $assets "therapist-3.jpg") -Width 768 -Height 1024 `
    -TopColor "#2a1e1e" -BottomColor "#140f0f" -Label "PLACEHOLDER`n月宸"

New-GradientJpg -Path (Join-Path $assets "therapist-4.jpg") -Width 768 -Height 1024 `
    -TopColor "#1e2420" -BottomColor "#0f1210" -Label "PLACEHOLDER`n星彌"
