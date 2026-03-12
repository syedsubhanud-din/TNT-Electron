# Build script for Python executables
# This script uses PyInstaller to bundle all Python scripts and their dependencies into standalone .exe files.
# This ensures the Electron app can run them offline without requiring a Python installation on the target machine.

$ErrorActionPreference = "Stop"

# 1. Install/Update requirements
Write-Host "--- Step 1: Installing dependencies ---" -ForegroundColor Cyan
pip install pyinstaller python-dotenv python-barcode qrcode pillow fastapi uvicorn

# 2. Define scripts to build
$scripts = @(
    "create_message.py",
    "message_manager.py",
    "print_label.py",
    "create_message/mv.py",
    "create_message/create_product_label.py",
    "create_message/run_command.py"
)

Write-Host "--- Step 2: Building executables ---" -ForegroundColor Cyan

foreach ($script in $scripts) {
    $scriptPath = Join-Path (Get-Location) $script
    $scriptDir = Split-Path $scriptPath -Parent
    $scriptName = Split-Path $scriptPath -Leaf
    $baseName = $scriptName.Replace(".py", "")

    Write-Host "Building $script..." -ForegroundColor Yellow

    # We use --onefile to bundle everything.
    # We use --noconfirm to overwrite existing.
    # We use --clean to clear cache.
    # We specify the output directory to match the script's location so the Electron app can find it.

    pyinstaller --onefile --noconfirm --clean `
                --distpath $scriptDir `
                --workpath (Join-Path $HOME "pyinstaller_work") `
                --specpath $scriptDir `
                $scriptPath
}

Write-Host "--- Step 3: Cleanup ---" -ForegroundColor Cyan
# Optional: remove build folders and spec files if you want to keep only the .exe
# Foreach ($script in $scripts) {
#     $specFile = $script.Replace(".py", ".spec")
#     if (Test-Path $specFile) { Remove-Item $specFile }
# }

Write-Host "All executables built successfully!" -ForegroundColor Green
Write-Host "You can now run 'npm run package' to build the Electron installer with these offline dependencies." -ForegroundColor Green
