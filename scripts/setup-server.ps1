<#
.SYNOPSIS
    Installe/répare le serveur dédié CS2 + Metamod + CounterStrikeSharp + le
    plugin LineupCapturePlugin, en encodant tous les pièges déjà documentés
    dans CLAUDE.md et docs/installation-locale.md.

.DESCRIPTION
    Idempotent : peut être relancé sans risque après une mise à jour CS2 (qui
    réécrit gameinfo.gi et efface le hook Metamod) — c'est d'ailleurs l'usage
    prévu en cas de blocage post-update, en fallback des étapes manuelles
    documentées dans docs/installation-locale.md.

    Ce script ne télécharge pas Metamod/CounterStrikeSharp lui-même (leurs URLs
    de release changent de version en version) — il attend des archives .zip
    déjà téléchargées, dont les chemins sont passés en paramètre.

.PARAMETER InstallDir
    Chemin ABSOLU d'installation du serveur dédié (ex. D:\Documents\Github\cs2server).
    Ne jamais passer un chemin relatif contenant '..' — bug documenté de SteamCMD
    qui l'ignore silencieusement et installe dans steamcmd\steamapps\common\... à
    la place (voir CLAUDE.md, "Cause racine identifiée").

.PARAMETER SteamCmdExe
    Chemin vers steamcmd.exe.

.PARAMETER MetamodZip
    Chemin vers l'archive Metamod:Source (build Windows, branche 2.x dev) déjà
    téléchargée.

.PARAMETER CounterStrikeSharpZip
    Chemin vers l'archive CounterStrikeSharp "with runtime" (build Windows) déjà
    téléchargée.

.PARAMETER PluginBuildDir
    Dossier de sortie de compilation du plugin (contient LineupCapturePlugin.dll),
    typiquement plugin\LineupCapturePlugin\bin\Release\net10.0\.

.PARAMETER ServerCfgDir
    Dossier des configs serveur versionnées (par défaut server-cfg\ à la racine
    du repo), copiées dans game\csgo\cfg\.

.PARAMETER SkipSteamCmd
    N'appelle pas SteamCMD (le dossier game\ est déjà à jour, par ex. après
    l'avoir déplacé manuellement depuis steamcmd\steamapps\common\...).

.PARAMETER SkipVerify
    Ne lance pas le serveur pour la vérification finale (utile en CI/sandbox sans
    accès réseau sortant vers Steam, ou pour ne patcher que les fichiers).

.EXAMPLE
    .\setup-server.ps1 -InstallDir D:\Documents\Github\cs2server `
        -SteamCmdExe C:\steamcmd\steamcmd.exe `
        -MetamodZip C:\downloads\mmsource-2.x-windows.zip `
        -CounterStrikeSharpZip C:\downloads\counterstrikesharp-with-runtime-windows.zip `
        -PluginBuildDir D:\Documents\Github\CS2-Nade-Studio\plugin\LineupCapturePlugin\bin\Release\net10.0
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir,

    [string]$SteamCmdExe,

    [string]$MetamodZip,
    [string]$CounterStrikeSharpZip,
    [string]$PluginBuildDir,

    [string]$ServerCfgDir = (Join-Path $PSScriptRoot "..\server-cfg"),

    [switch]$SkipSteamCmd,
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Warn($message) {
    Write-Host "!! $message" -ForegroundColor Yellow
}

# --- 0. Toujours un chemin absolu (voir CLAUDE.md : bug SteamCMD documenté avec
#     un chemin relatif contenant '..', ignoré silencieusement) ---

$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
if ($InstallDir -match '\.\.') {
    throw "InstallDir contient '..' même après résolution absolue ($InstallDir) — vérifier le chemin fourni."
}
Write-Host "Dossier d'installation résolu : $InstallDir"

$GameDir = Join-Path $InstallDir "game"
$Csgo = Join-Path $GameDir "csgo"
$AddonsDir = Join-Path $Csgo "addons"
$MetamodDir = Join-Path $AddonsDir "metamod"
$CssPluginsDir = Join-Path $AddonsDir "counterstrikesharp\plugins"
$CfgDir = Join-Path $Csgo "cfg"

# --- 1. Serveur dédié CS2 via SteamCMD ---

if ($SkipSteamCmd) {
    Write-Step "Mise à jour SteamCMD ignorée (-SkipSteamCmd)."
} else {
    if (-not $SteamCmdExe) {
        throw "-SteamCmdExe est requis sauf avec -SkipSteamCmd."
    }
    Write-Step "Installation/mise à jour du serveur dédié CS2 (App ID 730)"
    & $SteamCmdExe +force_install_dir $InstallDir +login anonymous +app_update 730 validate +quit
    if ($LASTEXITCODE -ne 0) {
        throw "steamcmd a échoué (code $LASTEXITCODE)."
    }
}

$Cs2Exe = Join-Path $GameDir "bin\win64\cs2.exe"
if (-not (Test-Path $Cs2Exe)) {
    throw "cs2.exe introuvable à $Cs2Exe après l'installation SteamCMD — vérifier InstallDir."
}

# --- 2. Metamod:Source ---

if ($MetamodZip) {
    Write-Step "Installation de Metamod:Source"
    if (-not (Test-Path $MetamodZip)) {
        throw "MetamodZip introuvable : $MetamodZip"
    }
    Expand-Archive -Path $MetamodZip -DestinationPath $Csgo -Force
} elseif (-not (Test-Path $MetamodDir)) {
    Write-Warn "Metamod absent et -MetamodZip non fourni — étape ignorée. Le serveur ne chargera aucun plugin tant que Metamod n'est pas installé."
}

$GameInfoPath = Join-Path $Csgo "gameinfo.gi"
if (Test-Path $GameInfoPath) {
    Write-Step "Vérification du hook Metamod dans gameinfo.gi"
    $gameInfoLines = Get-Content $GameInfoPath
    # Le fichier utilise des tabulations entre les tokens, pas des espaces —
    # comparaison tolérante aux espaces/tabulations dans les deux cas ci-dessous.
    $hookPattern = "^Game\s+csgo/addons/metamod$"
    $alreadyPatched = $gameInfoLines | Where-Object { $_.Trim() -match $hookPattern }

    if ($alreadyPatched) {
        Write-Host "Ligne déjà présente — rien à faire (idempotent)."
    } else {
        # Piège documenté : chaque mise à jour CS2 réécrit gameinfo.gi et efface
        # cette ligne, sans erreur ni avertissement (voir CLAUDE.md).
        $anchorPattern = "Game_LowViolence\s+csgo_lv"
        $anchorIndex = ($gameInfoLines | Select-String -Pattern $anchorPattern | Select-Object -First 1).LineNumber
        if (-not $anchorIndex) {
            throw "Ligne d'ancrage '$anchorPattern' introuvable dans gameinfo.gi — format inattendu, patch manuel requis."
        }
        $newLines = @()
        $newLines += $gameInfoLines[0..($anchorIndex - 1)]
        $newLines += "`tGame`tcsgo/addons/metamod"
        if ($anchorIndex -lt $gameInfoLines.Length) {
            $newLines += $gameInfoLines[$anchorIndex..($gameInfoLines.Length - 1)]
        }
        # Sans BOM, comme le fichier livré par Valve (Set-Content -Encoding UTF8
        # en ajoute un sous Windows PowerShell 5.1).
        [System.IO.File]::WriteAllLines($GameInfoPath, [string[]]$newLines, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "Ligne Metamod ajoutée sous '$anchorPattern'."
    }
} else {
    Write-Warn "gameinfo.gi introuvable à $GameInfoPath — étape ignorée."
}

# --- 3. CounterStrikeSharp ---

if ($CounterStrikeSharpZip) {
    Write-Step "Installation de CounterStrikeSharp"
    if (-not (Test-Path $CounterStrikeSharpZip)) {
        throw "CounterStrikeSharpZip introuvable : $CounterStrikeSharpZip"
    }
    # L'archive contient déjà un dossier racine addons\ : on l'extrait dans
    # csgo\, pas dans csgo\addons\ (sinon tout atterrit dans addons\addons\,
    # ignoré par Metamod).
    Expand-Archive -Path $CounterStrikeSharpZip -DestinationPath $Csgo -Force

    # Reste d'une ancienne version de ce script qui extrayait au mauvais niveau.
    $nestedAddons = Join-Path $AddonsDir "addons"
    if (Test-Path $nestedAddons) {
        Write-Warn "Dossier addons\addons\ trouvé (ancienne extraction au mauvais niveau) — suppression."
        Remove-Item -Recurse -Force $nestedAddons
    }

    # Piège documenté (CLAUDE.md) : l'archive dépose counterstrikesharp.vdf à la
    # racine de addons\ au lieu de addons\metamod\ — Metamod ne scanne que son
    # propre dossier, un .vdf mal placé est ignoré SANS erreur
    # ("[META] Loaded 0 plugins."). Vérification systématique, pas seulement au
    # premier run : un re-run du script (ou une réextraction manuelle) peut
    # réintroduire le fichier au mauvais endroit.
    $misplacedVdf = Join-Path $AddonsDir "counterstrikesharp.vdf"
    if (Test-Path $misplacedVdf) {
        Write-Warn "counterstrikesharp.vdf trouvé à la racine de addons\ — déplacement vers addons\metamod\ (piège connu)."
        Move-Item -Path $misplacedVdf -Destination (Join-Path $MetamodDir "counterstrikesharp.vdf") -Force
    }
}

# --- 4. Plugin LineupCapturePlugin ---

if ($PluginBuildDir) {
    Write-Step "Déploiement du plugin LineupCapturePlugin"
    if (-not (Test-Path $PluginBuildDir)) {
        throw "PluginBuildDir introuvable : $PluginBuildDir"
    }
    $pluginDest = Join-Path $CssPluginsDir "LineupCapturePlugin"
    New-Item -ItemType Directory -Force -Path $pluginDest | Out-Null
    Copy-Item -Path (Join-Path $PluginBuildDir "*") -Destination $pluginDest -Recurse -Force
}

# --- 5. Configs serveur (cfg\gamemode_competitive_server.cfg + cfg\prac.cfg) ---
#     Absents du dépôt Steam — perdus si game\ est un jour remplacé lors d'une
#     réinstall (voir CLAUDE.md). Source de vérité : server-cfg\ dans le repo,
#     copié ici à chaque passage. Une config en place qui diffère (modifiée à la
#     main dans game\) est d'abord sauvegardée en <nom>.<horodatage>.bak — un
#     ancien écrasement silencieux a déjà détruit la vraie config une fois.

Write-Step "Configs serveur depuis $ServerCfgDir"
$ServerCfgDir = [System.IO.Path]::GetFullPath($ServerCfgDir)
$repoCfgs = @(Get-ChildItem -Path $ServerCfgDir -Filter "*.cfg" -File -ErrorAction SilentlyContinue)
if ($repoCfgs.Count -eq 0) {
    throw "Aucune config .cfg trouvée dans $ServerCfgDir — la config practice versionnée est introuvable."
}
New-Item -ItemType Directory -Force -Path $CfgDir | Out-Null

foreach ($repoCfg in $repoCfgs) {
    $dest = Join-Path $CfgDir $repoCfg.Name
    if (Test-Path $dest) {
        if ((Get-FileHash $dest).Hash -eq (Get-FileHash $repoCfg.FullName).Hash) {
            Write-Host "$($repoCfg.Name) déjà à jour."
            continue
        }
        $backup = "$dest.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
        Copy-Item -Path $dest -Destination $backup
        Write-Warn "$($repoCfg.Name) différait de la version du repo — ancienne version sauvegardée dans $backup. Reporter dans server-cfg\ les modifications à garder."
    }
    Copy-Item -Path $repoCfg.FullName -Destination $dest -Force
    Write-Host "$($repoCfg.Name) copié."
}

# --- 6. Vérification finale ---

if ($SkipVerify) {
    Write-Step "Vérification ignorée (-SkipVerify)."
    return
}

Write-Step "Démarrage du serveur pour vérification (curl /position)"
$serverProcess = Start-Process -FilePath $Cs2Exe `
    -ArgumentList "-dedicated", "+map", "de_mirage", "+sv_lan", "1", "+sv_hibernate_when_empty", "0" `
    -PassThru -WindowStyle Minimized

try {
    $ok = $false
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5050/position" -TimeoutSec 2 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $ok = $true
                break
            }
        } catch {
            # Pas encore prêt — on retente jusqu'au timeout.
        }
    }

    if ($ok) {
        Write-Host "OK — /position répond, la chaîne complète (Metamod + CounterStrikeSharp + plugin) fonctionne." -ForegroundColor Green
    } else {
        Write-Warn "Échec — /position ne répond pas après 60s. Vérifier les logs de la console serveur :"
        Write-Warn "  - '[META] Loaded 0 plugins.' au démarrage => counterstrikesharp.vdf mal placé (voir étape 3)."
        Write-Warn "  - Pas de ligne 'CSSharp:' => plugin non chargé, vérifier PluginBuildDir / css_plugins list."
        Write-Warn "  - Aucune ligne de log du tout après le chargement de CounterStrikeSharp => voir CLAUDE.md,"
        Write-Warn "    section blocage lié aux continuations async côté plugin."
    }
} finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
    }
}
