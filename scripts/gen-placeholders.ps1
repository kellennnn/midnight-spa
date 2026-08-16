# Generates simple gradient placeholder images so the site builds and runs
# locally before real photography is supplied. Replace the files in
# public/photos with real, licensed/consented photos before going live.
# Each therapist gets 4 variant images (therapist-N.jpg = cover, plus
# therapist-N-2/3/4.jpg) so the detail gallery has something to show.

Add-Type -AssemblyName System.Drawing

function New-GradientJpg {
    param(
        [string]$Path,
        [int]$Width,
        [int]$Height,
        [string]$TopColor,
        [string]$BottomColor,
        [double]$RingCxRatio = 0.5,
        [double]$RingCyRatio = 0.4
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
    $cx = $Width * $RingCxRatio
    $cy = $Height * $RingCyRatio
    for ($r = 40; $r -lt [Math]::Max($Width, $Height); $r += 90) {
        $g.DrawEllipse($ringPen, $cx - $r, $cy - $r, $r * 2, $r * 2)
    }

    $g.Dispose()

    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 85L)
    $bmp.Save($Path, $encoder, $params)
    $bmp.Dispose()

    Write-Host "Wrote $Path"
}

$photos = Join-Path $PSScriptRoot "..\public\photos"
New-Item -ItemType Directory -Force -Path $photos | Out-Null

New-GradientJpg -Path (Join-Path $photos "hero-ripple.jpg") -Width 1920 -Height 1088 `
    -TopColor "#0d0d16" -BottomColor "#1a1420"

# Base color pair per therapist, then 4 ring-position variants each so the
# 4 images in one person's gallery look distinct but related.
$therapistColors = @(
    @{ Id = 1; Top = "#241b2e"; Bottom = "#120f16" },
    @{ Id = 2; Top = "#20232e"; Bottom = "#101216" },
    @{ Id = 3; Top = "#2a1e1e"; Bottom = "#140f0f" },
    @{ Id = 4; Top = "#1e2420"; Bottom = "#0f1210" }
)
$ringPositions = @(
    @{ Cx = 0.5; Cy = 0.4 },
    @{ Cx = 0.3; Cy = 0.6 },
    @{ Cx = 0.7; Cy = 0.3 },
    @{ Cx = 0.5; Cy = 0.7 }
)

foreach ($t in $therapistColors) {
    for ($i = 0; $i -lt $ringPositions.Length; $i++) {
        $suffix = if ($i -eq 0) { "" } else { "-$($i + 1)" }
        $pos = $ringPositions[$i]
        New-GradientJpg -Path (Join-Path $photos "therapist-$($t.Id)$suffix.jpg") -Width 768 -Height 1024 `
            -TopColor $t.Top -BottomColor $t.Bottom -RingCxRatio $pos.Cx -RingCyRatio $pos.Cy
    }
}
