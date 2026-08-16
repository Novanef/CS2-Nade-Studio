using System.Net;
using System.Text;
using System.Text.Json;
using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Modules.Cvars;
using CounterStrikeSharp.API.Modules.Utils;
using LineupCapturePlugin.Models;

namespace LineupCapturePlugin;

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
            HttpListenerContext context;
            try
            {
                // ConfigureAwait(false) partout dans ce fichier : sans ça, la continuation
                // tente de revenir sur le contexte capturé au moment de Load() (thread
                // principal du jeu), ce qui bloque tout le jeu après une certaine mise à
                // jour CS2 — confirmé par isolation en conditions réelles.
                context = await _listener.GetContextAsync().ConfigureAwait(false);
            }
            catch (HttpListenerException)
            {
                break; // listener was stopped
            }
            catch (ObjectDisposedException)
            {
                break;
            }

            _ = ProcessRequestAsync(context); // ne bloque pas l'écoute suivante
        }
    }

    private static readonly TimeSpan MainThreadTimeout = TimeSpan.FromSeconds(5);

    private async Task ProcessRequestAsync(HttpListenerContext context)
    {
        try
        {
            var path = context.Request.Url?.AbsolutePath;

            if (path == "/position" && context.Request.HttpMethod == "GET")
            {
                var position = await RunOnMainThreadAsync(GetCurrentPosition).ConfigureAwait(false);
                await WriteJsonAsync(context, position).ConfigureAwait(false);
            }
            else if (path == "/teleport" && context.Request.HttpMethod == "POST")
            {
                using var reader = new StreamReader(context.Request.InputStream);
                var body = await reader.ReadToEndAsync().ConfigureAwait(false);
                var request = JsonSerializer.Deserialize<TeleportRequest>(body);

                if (request is null)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    return;
                }

                await RunOnMainThreadAsync(() => TeleportPlayer(request)).ConfigureAwait(false);
                await WriteJsonAsync(context, new { success = true }).ConfigureAwait(false);
            }
            else if (path == "/capture/prepare" && context.Request.HttpMethod == "POST")
            {
                var original = await RunOnMainThreadAsync(PrepareCapture).ConfigureAwait(false);
                await WriteJsonAsync(context, new { success = true, original }).ConfigureAwait(false);
            }
            else if (path == "/capture/restore" && context.Request.HttpMethod == "POST")
            {
                using var reader = new StreamReader(context.Request.InputStream);
                var body = await reader.ReadToEndAsync().ConfigureAwait(false);
                var request = JsonSerializer.Deserialize<RestoreHudRequest>(body);

                if (request?.Original is null)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    return;
                }

                await RunOnMainThreadAsync(() => RestoreCapture(request.Original)).ConfigureAwait(false);
                await WriteJsonAsync(context, new { success = true }).ConfigureAwait(false);
            }
            else if (path == "/status" && context.Request.HttpMethod == "GET")
            {
                // Utilisé avant une téléportation vers un spawn : vérifie que le
                // serveur a bien chargé la carte attendue avant d'envoyer des
                // coordonnées qui n'ont de sens que sur cette carte précise.
                var mapName = await RunOnMainThreadAsync(() => Server.MapName).ConfigureAwait(false);
                await WriteJsonAsync(context, new { mapName }).ConfigureAwait(false);
            }
            else if (path == "/debug/entities" && context.Request.HttpMethod == "GET")
            {
                // Diagnostic temporaire — liste toutes les entités dont le nom de
                // classe (DesignerName) contient un des mots-clés donnés en query
                // string (?contains=smoke,fire,particle), pour identifier les
                // vraies entités derrière la fumée/le feu persistants.
                var keywords = (context.Request.QueryString["contains"] ?? "smoke,fire,particle,inferno")
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var names = await RunOnMainThreadAsync(() => ListEntityDesignerNames(keywords)).ConfigureAwait(false);
                await WriteJsonAsync(context, new { names }).ConfigureAwait(false);
            }
            else if (path == "/debug/spawns" && context.Request.HttpMethod == "GET")
            {
                // Diagnostic — énumère les entités de spawn (info_player_terrorist /
                // info_player_counterterrorist) de la carte actuellement chargée, pour
                // constituer une bonne fois pour toutes les données de spawn par carte
                // (statiques, jamais capturées par l'utilisateur final — voir
                // docs/structure-donnees-lineups.md, section "Lineups instantanés").
                var spawns = await RunOnMainThreadAsync(ListSpawnEntities).ConfigureAwait(false);
                await WriteJsonAsync(context, new { mapName = Server.MapName, spawns }).ConfigureAwait(false);
            }
            else if (path == "/debug/player_positions" && context.Request.HttpMethod == "GET")
            {
                // Diagnostic ponctuel — positions de TOUS les joueurs valides (bots
                // inclus, contrairement à GetCurrentPosition qui exclut les bots),
                // pour échantillonner empiriquement les spawns réellement utilisés
                // en mode compétitif sur plusieurs rounds (voir ListSpawnEntities,
                // qui renvoie un sur-ensemble incluant potentiellement des spawns
                // d'autres modes).
                var positions = await RunOnMainThreadAsync(ListPlayerPositions).ConfigureAwait(false);
                await WriteJsonAsync(context, new { positions }).ConfigureAwait(false);
            }
            else if (path == "/debug/cmd" && context.Request.HttpMethod == "POST")
            {
                // Diagnostic ponctuel — exécute une commande console arbitraire côté
                // serveur (ex. ent_dump) pour investiguer des propriétés d'entité non
                // exposées par l'API C#. Sortie visible dans la console/le log du
                // serveur, pas dans la réponse HTTP (Server.ExecuteCommand n'a pas de
                // valeur de retour) — à retirer une fois l'investigation terminée.
                var cmd = context.Request.QueryString["cmd"] ?? "";
                await RunOnMainThreadAsync(() => Server.ExecuteCommand(cmd)).ConfigureAwait(false);
                await WriteJsonAsync(context, new { executed = cmd }).ConfigureAwait(false);
            }
            else if (path == "/capture/check" && context.Request.HttpMethod == "GET")
            {
                // Diagnostic uniquement — lecture pure de HideHUD côté serveur, pour
                // vérifier s'il reste stable dans le temps ou s'il est réinitialisé
                // (ex. par un cycle d'échauffement qui recrée le pawn du joueur).
                var current = await RunOnMainThreadAsync(GetCurrentHideHud).ConfigureAwait(false);
                await WriteJsonAsync(context, new { current }).ConfigureAwait(false);
            }
            else
            {
                context.Response.StatusCode = 404;
                context.Response.Close();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LineupCapturePlugin] Erreur sur {context.Request.Url}: {ex}");
            try
            {
                context.Response.StatusCode = 500;
                context.Response.Close();
            }
            catch
            {
                // la réponse a peut-être déjà été fermée/envoyée
            }
        }
    }

    // Fait le pont entre le thread HTTP et le thread principal du jeu.
    // Un timeout évite qu'une requête reste bloquée indéfiniment si le
    // callback ne s'exécute jamais (ex. serveur pas encore en train de tick).
    private async Task<T> RunOnMainThreadAsync<T>(Func<T> fn)
    {
        var tcs = new TaskCompletionSource<T>();
        Server.NextFrame(() =>
        {
            try
            {
                tcs.TrySetResult(fn());
            }
            catch (Exception ex)
            {
                tcs.TrySetException(ex);
            }
        });

        var completed = await Task.WhenAny(tcs.Task, Task.Delay(MainThreadTimeout)).ConfigureAwait(false);
        if (completed != tcs.Task)
            throw new TimeoutException("Le serveur n'a pas répondu à temps (thread principal non disponible).");

        return await tcs.Task.ConfigureAwait(false);
    }

    private async Task RunOnMainThreadAsync(Action action)
    {
        var tcs = new TaskCompletionSource<bool>();
        Server.NextFrame(() =>
        {
            try
            {
                action();
                tcs.TrySetResult(true);
            }
            catch (Exception ex)
            {
                tcs.TrySetException(ex);
            }
        });

        var completed = await Task.WhenAny(tcs.Task, Task.Delay(MainThreadTimeout)).ConfigureAwait(false);
        if (completed != tcs.Task)
            throw new TimeoutException("Le serveur n'a pas répondu à temps (thread principal non disponible).");

        await tcs.Task.ConfigureAwait(false);
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
            // EyeAngles est l'angle de visée réel (yeux/caméra) ; AbsRotation ne reflète que
            // l'orientation du corps (le pitch y reste à 0 quel que soit le regard vertical).
            Pitch = pawn.EyeAngles?.X ?? 0,
            Yaw = pawn.EyeAngles?.Y ?? 0
        };
    }

    private void TeleportPlayer(TeleportRequest request)
    {
        var player = Utilities.GetPlayers()
            .FirstOrDefault(p => p is { IsValid: true, IsBot: false });

        if (player?.PlayerPawn?.Value is null)
            return;

        // setpos/setang via une commande client (comme si le joueur les tapait lui-même
        // dans sa console), plutôt que Teleport(). Passer un pitch non nul à Teleport()
        // fait pencher tout le corps du joueur — confirmé comme une limitation du moteur
        // CS2 actuel lui-même (reproduit à l'identique avec SharpTimer, plugin de
        // référence en production ; bug ouvert et non résolu :
        // github.com/Letaryat/poor-sharptimer/issues/133). setpos/setang passe par un
        // chemin de code natif différent qui n'a pas ce problème. Nécessite sv_cheats 1
        // sur le serveur (voir cfg/gamemode_competitive_server.cfg).
        var pos = FormattableString.Invariant($"{request.X} {request.Y} {request.Z}");
        var ang = FormattableString.Invariant($"{request.Pitch} {request.Yaw} 0");
        player.ExecuteClientCommandFromServer($"setpos {pos}");
        player.ExecuteClientCommandFromServer($"setang {ang}");
    }

    // HIDEHUD_ALL (bit 1<<2) — masque l'ensemble du HUD (santé, argent, armes, radar,
    // scoreboard...). Contrairement aux convars cl_* (cosmétiques, jamais répliquées
    // au serveur — confirmé non fonctionnel via ExecuteClientCommandFromServer et via
    // une entité point_clientcommand, deux tentatives sans effet), `HideHUD` est un
    // champ d'entité RÉSEAUTÉ et server-authoritative sur CCSPlayerPawn (même famille
    // que AbsOrigin/EyeAngles, déjà lus avec succès) — c'est le mécanisme utilisé par
    // le jeu lui-même pendant la cinématique d'intro d'un match compétitif. Le viseur
    // est masqué aussi (dessiné côté app à la place, voir app/core/capture.py — il est
    // toujours au centre exact de l'écran).
    private const uint HideHudAll = 0xFFFF;

    // La pièce manquante dans toutes les tentatives précédentes (convars cl_*,
    // entité point_clientcommand, événement GameEvent synthétique, ReplicateConVar
    // seul) : modifier `pawn.HideHUD` via le setter C# change la mémoire côté
    // SERVEUR (d'où la lecture cohérente via /capture/check) mais ne force pas le
    // moteur Source 2 à renvoyer cette valeur au client — sans marquer le champ
    // comme modifié, il n'est simplement jamais réseauté. `Utilities.SetStateChanged`
    // force cette propagation. Money masqué en complément via `ReplicateConVar`
    // (convar serveur légitime, pas cosmétique — voir plus haut pour la distinction).
    //
    // sv_grenade_trajectory (ligne de trajectoire), sv_grenade_trajectory_prac_pipreview
    // (caméra qui suit la grenade), sv_grenade_trajectory_prac_trailtime (durée
    // d'affichage du tracé après impact) et sv_showimpacts (marqueurs d'impact) sont
    // de vraies convars SERVEUR (sv_cheats), répliquées normalement à tous les
    // clients par le moteur — pas besoin des contournements ci-dessus (propres aux
    // convars cosmétiques cl_*/champs d'entité). Lues/écrites via `StringValue`
    // plutôt que `GetPrimitiveValue<bool>()`/`SetValue(bool)` : ce dernier a échoué
    // silencieusement pour sv_grenade_trajectory_prac_pipreview en conditions
    // réelles (restauration à la mauvaise valeur), probablement un type interne qui
    // n'est pas un vrai bool — StringValue fonctionne quel que soit le type réel.
    // "sv_grenade_trajectory" n'existe pas sur ce build CS2 (confirmé en jeu — la
    // console répond "n'existe pas") malgré plusieurs sources en ligne qui la
    // mentionnent ; ConVar.Find la retourne silencieusement à null et l'ignore, sans
    // effet ni erreur. Le masquage de la trajectoire repose donc entièrement sur
    // sv_grenade_trajectory_prac_pipreview (caméra) et _prac_trailtime (durée
    // d'affichage du tracé, mis à 0 — à valider en jeu si ça suffit à cacher la ligne).
    private static readonly string[] HideConVarNames =
    {
        "sv_grenade_trajectory_prac_pipreview",
        "sv_grenade_trajectory_prac_trailtime",
        "sv_showimpacts",
    };

    private CaptureState? PrepareCapture()
    {
        var player = Utilities.GetPlayers()
            .FirstOrDefault(p => p is { IsValid: true, IsBot: false });
        var pawn = player?.PlayerPawn?.Value;

        if (player is null || pawn is null)
            return null;

        var conVarOriginals = new Dictionary<string, string>();
        foreach (var name in HideConVarNames)
        {
            var conVar = ConVar.Find(name);
            if (conVar is null)
                continue;
            conVarOriginals[name] = conVar.StringValue;
            conVar.StringValue = "0";
        }

        var original = new CaptureState { HideHud = pawn.HideHUD, ConVars = conVarOriginals };

        pawn.HideHUD = HideHudAll;
        Utilities.SetStateChanged(pawn, "CBasePlayerPawn", "m_iHideHUD");
        player.ReplicateConVar("mp_maxmoney", "0");
        LineupCapturePlugin.HideEffectsForCapture = true;

        return original;
    }

    private void RestoreCapture(CaptureState original)
    {
        var player = Utilities.GetPlayers()
            .FirstOrDefault(p => p is { IsValid: true, IsBot: false });
        var pawn = player?.PlayerPawn?.Value;

        if (player is null || pawn is null)
            return;

        pawn.HideHUD = original.HideHud;
        Utilities.SetStateChanged(pawn, "CBasePlayerPawn", "m_iHideHUD");

        if (original.ConVars is not null)
        {
            foreach (var (name, value) in original.ConVars)
            {
                var conVar = ConVar.Find(name);
                if (conVar is not null)
                    conVar.StringValue = value;
            }
        }

        var maxMoney = ConVar.Find("mp_maxmoney")?.GetPrimitiveValue<int>() ?? 16000;
        player.ReplicateConVar("mp_maxmoney", maxMoney.ToString());
        LineupCapturePlugin.HideEffectsForCapture = false;
    }

    private List<string> ListEntityDesignerNames(string[] keywords)
    {
        var counts = new Dictionary<string, int>();
        foreach (var entity in Utilities.GetAllEntities())
        {
            var name = entity.DesignerName;
            if (string.IsNullOrEmpty(name))
                continue;
            if (!keywords.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase)))
                continue;
            counts[name] = counts.GetValueOrDefault(name) + 1;
        }
        return counts.Select(kv => $"{kv.Key} x{kv.Value}").OrderBy(s => s).ToList();
    }

    private List<object> ListSpawnEntities()
    {
        var result = new List<object>();
        foreach (var entity in Utilities.GetAllEntities())
        {
            if (entity.DesignerName != "info_player_terrorist" && entity.DesignerName != "info_player_counterterrorist")
                continue;

            var origin = entity.As<CBaseEntity>()?.AbsOrigin;
            if (origin is null)
                continue;

            result.Add(new
            {
                side = entity.DesignerName == "info_player_terrorist" ? "T" : "CT",
                x = origin.X,
                y = origin.Y,
                z = origin.Z,
            });
        }
        return result;
    }

    private List<object> ListPlayerPositions()
    {
        var result = new List<object>();
        foreach (var player in Utilities.GetPlayers())
        {
            if (player is not { IsValid: true })
                continue;

            var pawn = player.PlayerPawn?.Value;
            if (pawn?.AbsOrigin is null)
                continue;

            result.Add(new
            {
                name = player.PlayerName,
                team = player.TeamNum,
                isBot = player.IsBot,
                x = pawn.AbsOrigin.X,
                y = pawn.AbsOrigin.Y,
                z = pawn.AbsOrigin.Z,
            });
        }
        return result;
    }

    private uint? GetCurrentHideHud()
    {
        var pawn = Utilities.GetPlayers()
            .FirstOrDefault(p => p is { IsValid: true, IsBot: false })?.PlayerPawn?.Value;

        return pawn?.HideHUD;
    }

    private async Task WriteJsonAsync(HttpListenerContext context, object data)
    {
        var json = JsonSerializer.Serialize(data);
        var buffer = Encoding.UTF8.GetBytes(json);
        context.Response.ContentType = "application/json";
        context.Response.ContentLength64 = buffer.Length;
        await context.Response.OutputStream.WriteAsync(buffer).ConfigureAwait(false);
        context.Response.Close();
    }
}
