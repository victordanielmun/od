Write-Host "=== Setting up Piper TTS locally ==="

# 1. Create directories
$binDir = Join-Path $PSScriptRoot "bin"
$modelsDir = Join-Path $PSScriptRoot "models"

if (!(Test-Path $binDir)) { New-Item -ItemType Directory -Force -Path $binDir }
if (!(Test-Path $modelsDir)) { New-Item -ItemType Directory -Force -Path $modelsDir }

# 2. Download Piper binary for Windows
$zipPath = Join-Path $binDir "piper_windows_amd64.zip"
$piperExe = Join-Path $binDir "piper\piper.exe"

if (!(Test-Path $piperExe)) {
    Write-Host "Downloading Piper Windows binary..."
    $url = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    
    Write-Host "Extracting Piper binary..."
    Expand-Archive -Path $zipPath -DestinationPath $binDir -Force
    
    # Clean up zip
    Remove-Item $zipPath -Force
} else {
    Write-Host "Piper binary already exists."
}

# 3. Download Models
$models = @(
    @{ name = "en_US-joe-medium.onnx"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx?download=true" },
    @{ name = "en_US-joe-medium.onnx.json"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json?download=true" },
    @{ name = "en_US-ryan-medium.onnx"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx?download=true" },
    @{ name = "en_US-ryan-medium.onnx.json"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json?download=true" },
    @{ name = "en_US-amy-medium.onnx"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx?download=true" },
    @{ name = "en_US-amy-medium.onnx.json"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json?download=true" },
    @{ name = "en_US-lessac-medium.onnx"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true" },
    @{ name = "en_US-lessac-medium.onnx.json"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true" },
    @{ name = "en_US-kristin-medium.onnx"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/en_US-kristin-medium.onnx?download=true" },
    @{ name = "en_US-kristin-medium.onnx.json"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/en_US-kristin-medium.onnx.json?download=true" },
    @{ name = "en_US-norman-medium.onnx"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/norman/medium/en_US-norman-medium.onnx?download=true" },
    @{ name = "en_US-norman-medium.onnx.json"; url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/norman/medium/en_US-norman-medium.onnx.json?download=true" }
)

foreach ($model in $models) {
    $filePath = Join-Path $modelsDir $model.name
    if (!(Test-Path $filePath)) {
        Write-Host "Downloading model $($model.name)..."
        Invoke-WebRequest -Uri $model.url -OutFile $filePath
    } else {
        Write-Host "Model $($model.name) already exists."
    }
}

Write-Host "=== Setup completed successfully! ==="
