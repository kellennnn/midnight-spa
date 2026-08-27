# One-off: generates ONLY therapist-5.jpg .. therapist-16.jpg placeholders.
# Does NOT touch hero-ripple.jpg or therapist-1..4.jpg (those already have
# real photos the user uploaded).

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

$ringPositions = @(
    @{ Cx = 0.5; Cy = 0.4 },
    @{ Cx = 0.3; Cy = 0.6 },
    @{ Cx = 0.7; Cy = 0.3 },
    @{ Cx = 0.5; Cy = 0.7 }
)

$moreColors = @(
    @{ Id = 5;  Top = "#232030"; Bottom = "#121018" },
    @{ Id = 6;  Top = "#2b1f26"; Bottom = "#150f13" },
    @{ Id = 7;  Top = "#1f2530"; Bottom = "#0f1218" },
    @{ Id = 8;  Top = "#292024"; Bottom = "#141012" },
    @{ Id = 9;  Top = "#26222f"; Bottom = "#131118" },
    @{ Id = 10; Top = "#2d1e28"; Bottom = "#160f14" },
    @{ Id = 11; Top = "#1e2833"; Bottom = "#0f141a" },
    @{ Id = 12; Top = "#2a2320"; Bottom = "#151110" },
    @{ Id = 13; Top = "#232a2c"; Bottom = "#111516" },
    @{ Id = 14; Top = "#2c1f2b"; Bottom = "#150f15" },
    @{ Id = 15; Top = "#242030"; Bottom = "#121018" },
    @{ Id = 16; Top = "#1f242b"; Bottom = "#0f1216" }
)

for ($j = 0; $j -lt $moreColors.Length; $j++) {
    $c = $moreColors[$j]
    $pos = $ringPositions[$j % $ringPositions.Length]
    New-GradientJpg -Path (Join-Path $photos "therapist-$($c.Id).jpg") -Width 768 -Height 1024 `
        -TopColor $c.Top -BottomColor $c.Bottom -RingCxRatio $pos.Cx -RingCyRatio $pos.Cy
}
