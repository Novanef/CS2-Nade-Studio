# CS2-Nade-Studio
Windows companion app for browsing and building CS2 grenade lineups — secondary-screen reference during play, live capture via a local server plugin.

## Troubleshooting

### The local dedicated server won't start ("Access denied" on `cs2.exe`)

Quit the **FACEIT anti-cheat** before starting the server. While it is running, it blocks any process named `cs2.exe` other than the game client launched by Steam. Windows then refuses to start the dedicated server with "Access denied", and no Windows log explains why. Closing CS2 alone is not enough; the anti-cheat itself has to be quit.
