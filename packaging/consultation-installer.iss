; Installeur Inno Setup du build consultation-only (browse + radar, sans
; capture/plugin CS2) — voir app/main_consultation.py et packaging/consultation.spec.
;
; Prérequis : avoir déjà généré dist/CS2NadeStudioViewer/ via
;   pyinstaller packaging/consultation.spec --distpath dist --workpath build
; avant de compiler ce script (ISCC.exe packaging/consultation-installer.iss).
;
; Installation par utilisateur (PrivilegesRequired=lowest, sous
; %LocalAppData%\Programs\...) plutôt que dans Program Files : évite toute
; invite UAC/mot de passe admin, cohérent avec la cible (joueurs non-techniques
; installant sur leur propre PC de jeu).

#define MyAppName "CS2 Nade Studio — Bibliothèque"
#define MyAppVersion "1.0.0"
#define MyAppExeName "CS2NadeStudioViewer.exe"
#define MyDistDir "..\dist\CS2NadeStudioViewer"

[Setup]
; GUID fixe — ne JAMAIS le régénérer une fois publié : Inno Setup s'en sert
; pour détecter une mise à jour vs une nouvelle installation.
AppId={{6C6E3D8B-6D6A-4B0E-9C1E-6B0C1E5B7D9A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
; {localappdata}\Programs\... (pas {autopf}\Program Files) : cohérent avec
; PrivilegesRequired=lowest, aucun droit admin nécessaire pour installer.
DefaultDirName={localappdata}\Programs\CS2NadeStudioViewer
DefaultGroupName=CS2 Nade Studio
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
UsedUserAreasWarning=no
OutputBaseFilename=CS2NadeStudioViewerSetup
OutputDir=..\dist-installer
SetupIconFile={#MyDistDir}\..\..\app\assets\app_icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Raccourcis :"

[Files]
Source: "{#MyDistDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Désinstaller {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Lancer {#MyAppName}"; Flags: nowait postinstall skipifsilent
