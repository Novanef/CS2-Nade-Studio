# Tests Pester (compatible 3.x, livré avec Windows) pour scripts/setup-server.ps1.
# Lancer : Invoke-Pester scripts\tests

$ScriptPath = Join-Path $PSScriptRoot "..\setup-server.ps1"

function New-FakeInstall($root) {
    # Arborescence minimale d'un serveur dédié : cs2.exe + gameinfo.gi déjà patché.
    $csgo = Join-Path $root "game\csgo"
    New-Item -ItemType Directory -Force -Path (Join-Path $root "game\bin\win64") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $csgo "addons\metamod") | Out-Null
    Set-Content -Path (Join-Path $root "game\bin\win64\cs2.exe") -Value "fake"
    Set-Content -Path (Join-Path $csgo "gameinfo.gi") -Value @(
        "`t`t`tGame_LowViolence`tcsgo_lv"
        "`t`t`tGame`tcsgo/addons/metamod"
    )
    return $csgo
}

function New-FakeCssZip($dir) {
    # Même disposition que l'archive officielle "with runtime" : tout sous un
    # dossier racine addons\, .vdf compris sous addons\metamod\.
    $src = Join-Path $dir "zipsrc"
    New-Item -ItemType Directory -Force -Path (Join-Path $src "addons\counterstrikesharp\api") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $src "addons\metamod") | Out-Null
    Set-Content -Path (Join-Path $src "addons\counterstrikesharp\api\CounterStrikeSharp.API.dll") -Value "fake"
    Set-Content -Path (Join-Path $src "addons\metamod\counterstrikesharp.vdf") -Value "fake"
    $zip = Join-Path $dir "css.zip"
    Compress-Archive -Path (Join-Path $src "addons") -DestinationPath $zip
    return $zip
}

Describe "setup-server.ps1 — hook Metamod dans gameinfo.gi" {
    It "ajoute la ligne Metamod sans introduire de BOM UTF-8 (fichier d'origine sans BOM)" {
        # Arrange
        $root = Join-Path $env:TEMP ("setup-server-test-" + [guid]::NewGuid())
        $csgo = New-FakeInstall (Join-Path $root "server")
        $gameInfo = Join-Path $csgo "gameinfo.gi"
        [IO.File]::WriteAllText($gameInfo, "`"GameInfo`"`r`n`t`t`tGame_LowViolence`tcsgo_lv`r`n", (New-Object Text.UTF8Encoding $false))

        try {
            # Act
            & $ScriptPath -InstallDir (Join-Path $root "server") -SkipSteamCmd -SkipVerify *> $null

            # Assert
            $bytes = [IO.File]::ReadAllBytes($gameInfo)
            $bytes[0] | Should Be 0x22
            (Get-Content $gameInfo) -match "^\s*Game\s+csgo/addons/metamod$" | Should Not BeNullOrEmpty
        } finally {
            Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
        }
    }
}

Describe "setup-server.ps1 — installation de CounterStrikeSharp" {
    It "extrait l'archive dans csgo\addons\ sans créer de dossier addons\addons\" {
        # Arrange
        $root = Join-Path $env:TEMP ("setup-server-test-" + [guid]::NewGuid())
        $csgo = New-FakeInstall (Join-Path $root "server")
        $zip = New-FakeCssZip $root

        try {
            # Act
            & $ScriptPath -InstallDir (Join-Path $root "server") -SkipSteamCmd -SkipVerify `
                -CounterStrikeSharpZip $zip *> $null

            # Assert
            Join-Path $csgo "addons\counterstrikesharp\api\CounterStrikeSharp.API.dll" | Should Exist
            Join-Path $csgo "addons\metamod\counterstrikesharp.vdf" | Should Exist
            Join-Path $csgo "addons\addons" | Should Not Exist
        } finally {
            Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
        }
    }

    It "supprime un dossier addons\addons\ laissé par une ancienne version du script" {
        # Arrange
        $root = Join-Path $env:TEMP ("setup-server-test-" + [guid]::NewGuid())
        $csgo = New-FakeInstall (Join-Path $root "server")
        New-Item -ItemType Directory -Force -Path (Join-Path $csgo "addons\addons\counterstrikesharp") | Out-Null
        $zip = New-FakeCssZip $root

        try {
            # Act
            & $ScriptPath -InstallDir (Join-Path $root "server") -SkipSteamCmd -SkipVerify `
                -CounterStrikeSharpZip $zip *> $null

            # Assert
            Join-Path $csgo "addons\addons" | Should Not Exist
        } finally {
            Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
        }
    }
}
