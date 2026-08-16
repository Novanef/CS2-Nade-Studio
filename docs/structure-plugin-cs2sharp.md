# Structure du plugin serveur — CounterStrikeSharp

Complète `architecture-technique-lineups.md`. Ce document détaille l'organisation interne du plugin qui tourne sur le serveur CS2 dédié local, et qui expose le canal HTTP utilisé par l'application.

## Arborescence

```
LineupCapturePlugin/
├── LineupCapturePlugin.csproj
├── LineupCapturePlugin.cs      (point d'entrée du plugin)
├── HttpApiServer.cs            (serveur HTTP embarqué)
└── Models/
    ├── PositionResponse.cs
    └── TeleportRequest.cs
```

## Contrainte centrale : deux threads qui ne se mélangent pas

Le plugin doit faire cohabiter deux mondes :

- **Le thread principal du jeu**, sur lequel tournent les entités (joueur, position, téléportation) — c'est le seul endroit où on a le droit de les lire ou de les modifier.
- **Un thread HTTP en arrière-plan**, qui écoute les requêtes de l'application à tout moment, indépendamment du tick du jeu.

CounterStrikeSharp fournit `Server.NextFrame(callback)` pour planifier l'exécution d'un morceau de code sur le thread principal, au prochain tick. Toute lecture ou modification d'entité déclenchée par une requête HTTP passe donc par ce mécanisme — jamais d'accès direct depuis le thread HTTP.

## Le plugin principal

```csharp
using CounterStrikeSharp.API.Core;

public class LineupCapturePlugin : BasePlugin
{
    public override string ModuleName => "Lineup Capture API";
    public override string ModuleVersion => "0.1.0";

    private HttpApiServer? _server;

    public override void Load(bool hotReload)
    {
        _server = new HttpApiServer(port: 5050);
        _server.Start();
    }

    public override void Unload(bool hotReload)
    {
        _server?.Stop();
    }
}
```

## Le serveur HTTP embarqué

Utilise `HttpListener` (.NET standard, aucune dépendance externe) plutôt qu'un framework web complet — largement suffisant pour deux endpoints locaux.

```csharp
using System.Net;
using System.Text;
using System.Text.Json;
using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Modules.Utils;

public class HttpApiServer
{
    private readonly HttpListener _listener = new();

    public HttpApiServer(int port)
    {
        _listener.Prefixes.Add($"http://localhost:{port}/");
    }

    public void Start()
    {
        _listener.Start();
        _ = HandleRequestsAsync();
    }

    public void Stop() => _listener.Stop();

    private async Task HandleRequestsAsync()
    {
        while (_listener.IsListening)
        {
            var context = await _listener.GetContextAsync();
            _ = ProcessRequestAsync(context); // ne bloque pas l'écoute suivante
        }
    }

    private async Task ProcessRequestAsync(HttpListenerContext context)
    {
        var path = context.Request.Url?.AbsolutePath;

        if (path == "/position" && context.Request.HttpMethod == "GET")
        {
            var position = await RunOnMainThreadAsync(GetCurrentPosition);
            await WriteJsonAsync(context, position);
        }
        else if (path == "/teleport" && context.Request.HttpMethod == "POST")
        {
            using var reader = new StreamReader(context.Request.InputStream);
            var body = await reader.ReadToEndAsync();
            var request = JsonSerializer.Deserialize<TeleportRequest>(body);

            await RunOnMainThreadAsync(() => TeleportPlayer(request!));
            await WriteJsonAsync(context, new { success = true });
        }
        else
        {
            context.Response.StatusCode = 404;
            context.Response.Close();
        }
    }

    // Fait le pont entre le thread HTTP et le thread principal du jeu
    private Task<T> RunOnMainThreadAsync<T>(Func<T> fn)
    {
        var tcs = new TaskCompletionSource<T>();
        Server.NextFrame(() => tcs.SetResult(fn()));
        return tcs.Task;
    }

    private Task RunOnMainThreadAsync(Action action)
    {
        var tcs = new TaskCompletionSource<bool>();
        Server.NextFrame(() => { action(); tcs.SetResult(true); });
        return tcs.Task;
    }

    private PositionResponse GetCurrentPosition()
    {
        var player = Utilities.GetPlayers()
            .FirstOrDefault(p => p is { IsValid: true, IsBot: false });
        var pawn = player?.PlayerPawn?.Value;

        if (pawn?.AbsOrigin is null)
            return new PositionResponse { Found = false };

        return new PositionResponse
        {
            Found = true,
            X = pawn.AbsOrigin.X,
            Y = pawn.AbsOrigin.Y,
            Z = pawn.AbsOrigin.Z,
            Pitch = pawn.AbsRotation?.X ?? 0,
            Yaw = pawn.AbsRotation?.Y ?? 0
        };
    }

    private void TeleportPlayer(TeleportRequest request)
    {
        var player = Utilities.GetPlayers()
            .FirstOrDefault(p => p is { IsValid: true, IsBot: false });
        var pawn = player?.PlayerPawn?.Value;

        pawn?.Teleport(
            new Vector(request.X, request.Y, request.Z),
            new QAngle(request.Pitch, request.Yaw, 0)
        );
    }

    private async Task WriteJsonAsync(HttpListenerContext context, object data)
    {
        var json = JsonSerializer.Serialize(data);
        var buffer = Encoding.UTF8.GetBytes(json);
        context.Response.ContentType = "application/json";
        context.Response.ContentLength64 = buffer.Length;
        await context.Response.OutputStream.WriteAsync(buffer);
        context.Response.Close();
    }
}
```

## Les modèles

```csharp
public class PositionResponse
{
    public bool Found { get; set; }
    public float X { get; set; }
    public float Y { get; set; }
    public float Z { get; set; }
    public float Pitch { get; set; }
    public float Yaw { get; set; }
}

public class TeleportRequest
{
    public float X { get; set; }
    public float Y { get; set; }
    public float Z { get; set; }
    public float Pitch { get; set; }
    public float Yaw { get; set; }
}
```

## Correspondance avec le modèle de données de l'application

`GetCurrentPosition()` renvoie exactement les champs `position` et `viewAngle` d'un `Waypoint` (voir `structure-donnees-lineups.md`) ; `/teleport` consomme ces mêmes champs dans l'autre sens. Aucune conversion supplémentaire n'est nécessaire entre les deux documents.

## Routes de diagnostic ponctuelles

En plus des routes ci-dessus (illustratives — voir le code réel dans `HttpApiServer.cs` pour la version à jour, qui inclut aussi `/capture/prepare`, `/capture/restore`, `/capture/check` et `/debug/entities`) :

- `/debug/spawns` (GET) énumère les entités `info_player_terrorist`/`info_player_counterterrorist` de la carte chargée — utilisée pour constituer `app/data/seed/spawnpoints.json` (positions de spawn fixes, jamais capturées par l'utilisateur final, voir `structure-donnees-lineups.md`). **Attention** : renvoie un sur-ensemble incluant des spawns d'autres modes (Wingman notamment) — la vraie liste compétitive a dû être confirmée empiriquement (voir `/debug/player_positions` ci-dessous), pas prise telle quelle.
- `/debug/player_positions` (GET) renvoie la position de tous les joueurs valides (bots inclus, contrairement à `GetCurrentPosition` qui ne prend que le premier humain) — a servi à échantillonner sur plusieurs rounds équilibrés (5v5, bots ajoutés via `bot_add_t`/`bot_add_ct`) quels spawns du sur-ensemble ci-dessus sont réellement utilisés en compétitif.
- `/debug/cmd` (POST, `?cmd=...`) exécute une commande console arbitraire côté serveur (`Server.ExecuteCommand`) — a servi à forcer des redémarrages de round (`mp_restartgame 1`) pendant l'échantillonnage. Plus risquée que les autres routes (exécution de commande, pas juste lecture) mais conservée comme outil de diagnostic générique, décision explicite malgré le risque (serveur local uniquement).

Toutes trois laissées en place comme outils de diagnostic réutilisables, pas retirées après usage.

## Points à valider en développement

- **Nom exact de la propriété d'angle de vue** : cet exemple utilise `AbsRotation`, vu dans un exemple officiel de CounterStrikeSharp pour orienter une téléportation. Pour capturer la direction précise du regard (plutôt que l'orientation du corps), vérifier dans la documentation à jour (`docs.cssharp.dev`) s'il existe une propriété dédiée à la visée de la caméra — les deux ne coïncident pas forcément exactement.
- **Un seul joueur humain supposé** : `GetCurrentPosition`/`TeleportPlayer` prennent le premier joueur non-bot trouvé, cohérent avec un usage solo sur serveur local. À adapter si plusieurs joueurs humains doivent un jour l'utiliser en même temps.
- **Port fixe (5050)** : à rendre configurable si un conflit de port survient sur votre machine.
- **Pas d'authentification** : acceptable puisque le serveur n'écoute que sur `localhost`, donc inaccessible depuis l'extérieur de la machine.
