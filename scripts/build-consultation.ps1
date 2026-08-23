<#
.SYNOPSIS
    Reconstruit le build consultation-only (exe PyInstaller + installeur Inno
    Setup) après une modification du code de l'app.

.DESCRIPTION
    Enchaîne : fermeture de l'app si elle tourne (sinon PyInstaller échoue sur
    des fichiers verrouillés dans dist\CS2NadeStudioViewer\_internal\), nettoyage
    du build précédent, build PyInstaller (packaging/consultation.spec), puis
    compilation de l'installeur (packaging/consultation-installer.iss).

    Crée automatiquement le venv de build (app/.venv-consultation) au premier
    lancement s'il n'existe pas encore, avec uniquement
    app/requirements-consultation.txt (jamais les dépendances capture-only de
    l'app complète — voir app/core/api_base.py).

.PARAMETER SkipInstaller
    Ne compile que l'exe (dist\CS2NadeStudioViewer\), sans régénérer
    l'installeur Inno Setup.

.EXAMPLE
    .\scripts\build-consultation.ps1
#>

[CmdletBinding()]
param(
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $RepoRoot "app"
$VenvDir = Join-Path $AppDir ".venv-consultation"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPyInstaller = Join-Path $VenvDir "Scripts\pyinstaller.exe"

# --- 0. Fermer l'app si elle tourne (verrouille _internal\*.dll sinon) ---

$running = Get-Process -Name "CS2NadeStudioViewer" -ErrorAction SilentlyContinue
if ($running) {
    Write-Step "Fermeture de CS2NadeStudioViewer.exe (en cours d'exécution)"
    $running | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# --- 1. Venv de build (créé au besoin, uniquement requirements-consultation.txt) ---

if (-not (Test-Path $VenvPython)) {
    Write-Step "Création du venv de build ($VenvDir)"
    python -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) {
        throw "Échec de création du venv."
    }
    & $VenvPython -m pip install --upgrade pip | Out-Null
}

Write-Step "Installation/mise à jour des dépendances de build"
& $VenvPython -m pip install -r (Join-Path $AppDir "requirements-consultation.txt")
if ($LASTEXITCODE -ne 0) {
    throw "pip install a échoué."
}

# --- 2. Nettoyage du build précédent (évite les caches PyInstaller périmés) ---

Write-Step "Nettoyage de build\consultation et dist\CS2NadeStudioViewer"
Remove-Item -Recurse -Force (Join-Path $RepoRoot "build\consultation") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $RepoRoot "dist\CS2NadeStudioViewer") -ErrorAction SilentlyContinue

# --- 3. Build PyInstaller ---

Write-Step "Build PyInstaller (packaging\consultation.spec)"
Push-Location $RepoRoot
try {
    & $VenvPyInstaller "packaging\consultation.spec" --distpath dist --workpath build --noconfirm
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller a échoué (code $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

$ExePath = Join-Path $RepoRoot "dist\CS2NadeStudioViewer\CS2NadeStudioViewer.exe"
if (-not (Test-Path $ExePath)) {
    throw "Build terminé mais $ExePath introuvable — vérifier les logs PyInstaller ci-dessus."
}
Write-Host "Exe généré : $ExePath" -ForegroundColor Green

if ($SkipInstaller) {
    Write-Step "Installeur ignoré (-SkipInstaller)."
    return
}

# --- 4. Compilation de l'installeur Inno Setup ---

Write-Step "Recherche d'Inno Setup (ISCC.exe)"
$IsccPath = $null
$uninstallKeys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
foreach ($key in $uninstallKeys) {
    $entry = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like "Inno Setup*" } |
        Select-Object -First 1
    if ($entry -and $entry.InstallLocation) {
        $candidate = Join-Path $entry.InstallLocation "ISCC.exe"
        if (Test-Path $candidate) {
            $IsccPath = $candidate
            break
        }
    }
}
if (-not $IsccPath) {
    # Emplacements par défaut si la recherche registre échoue.
    $fallbacks = @(
        "$env:LocalAppData\Programs\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    )
    $IsccPath = $fallbacks | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $IsccPath) {
    throw "ISCC.exe introuvable — installer Inno Setup (winget install --id JRSoftware.InnoSetup -e) ou relancer avec -SkipInstaller."
}
Write-Host "Trouvé : $IsccPath"

Write-Step "Compilation de l'installeur (packaging\consultation-installer.iss)"
& $IsccPath (Join-Path $RepoRoot "packaging\consultation-installer.iss")
if ($LASTEXITCODE -ne 0) {
    throw "ISCC a échoué (code $LASTEXITCODE)."
}

$SetupPath = Join-Path $RepoRoot "dist-installer\CS2NadeStudioViewerSetup.exe"
if (Test-Path $SetupPath) {
    $size = [math]::Round((Get-Item $SetupPath).Length / 1MB, 1)
    Write-Host ""
    Write-Host "OK — installeur généré : $SetupPath ($size Mo)" -ForegroundColor Green
} else {
    Write-Warning "ISCC a réussi mais $SetupPath introuvable — vérifier OutputDir dans le .iss."
}
