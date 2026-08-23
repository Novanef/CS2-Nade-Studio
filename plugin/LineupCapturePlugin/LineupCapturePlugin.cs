using System;
using System.Linq;
using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Memory;
using CounterStrikeSharp.API.Modules.Utils;

namespace LineupCapturePlugin;

public class LineupCapturePlugin : BasePlugin
{
    public override string ModuleName => "Lineup Capture API";
    public override string ModuleVersion => "0.1.0";

    private HttpApiServer? _server;

    // Vu par HttpApiServer (PrepareCapture) pour activer/désactiver la suppression
    // des grenades/fumée/feu pendant une capture — voir Load() ci-dessous. Masquer
    // uniquement la transmission (comme pour prop_door_rotating dans le TestPlugin
    // officiel CounterStrikeSharp) suffit pour un projectile encore en vol (mise à
    // jour réseau continue), mais PAS pour le nuage de fumée ou le feu une fois
    // détonés : ce sont des effets particules déclenchés une fois côté client (joués
    // localement dès réception de l'événement de détonation), et couper leur
    // transmission après coup ne les arrête pas rétroactivement (confirmé en
    // conditions réelles). Solution retenue pour tout, par simplicité et fiabilité :
    // suppression directe (`.Remove()`) de ces entités, en continu à chaque tick
    // tant que la capture est en cours (pas un seul passage — le feu d'un molotov
    // continue de faire apparaître de nouveaux segments `inferno` pendant qu'il se
    // propage). Pas de restauration possible ni cherchée (un screenshot n'a pas
    // besoin que ces objets continuent d'exister après coup).
    public static bool HideEffectsForCapture = false;

    private static readonly string[] EffectDesignerNames =
    {
        "smokegrenade_projectile",
        "hegrenade_projectile",
        "flashbang_projectile",
        "decoy_projectile",
        "molotov_projectile",
        "inferno", // logique/dégâts du feu des incendiaires/molotov — seule entité feu confirmée (pas _firesmoke)
        "_firesmoke", // gardé par précaution, aucun effet constaté sur ce build
        "info_particle_system", // gardé par précaution, aucun effet constaté sur ce build
    };

    public override void Load(bool hotReload)
    {
        _server = new HttpApiServer(port: 5050);
        _server.Start();

        // Le moteur remet TOUS les convars serveur à leurs valeurs par défaut à la
        // déconnexion du dernier joueur humain (ResetGameConVarsToDefaults, vu dans les
        // logs du jeu), ce qui efface sv_cheats, munitions/grenades illimitées, régén,
        // etc. — pas seulement au lancement du serveur comme documenté initialement (voir
        // CLAUDE.md). Rien ne permet d'empêcher ce reset côté convars (sv_hibernate_when_empty
        // lui-même est remis à sa valeur par défaut par ce même mécanisme). La seule option
        // fiable est de réappliquer toute la config practice à la reconnexion, exactement
        // comme au démarrage du serveur — d'où le exec ici du même fichier hook plutôt que
        // de dupliquer sa liste de convars en C#.
        RegisterEventHandler<EventPlayerConnectFull>((@event, info) =>
        {
            var player = @event.Userid;
            if (player != null && !player.IsBot)
                Server.ExecuteCommand("exec gamemode_competitive_server.cfg");
            return HookResult.Continue;
        });

        RegisterListener<Listeners.CheckTransmit>((CCheckTransmitInfoList infoList) =>
        {
            if (HideEffectsForCapture)
                RemoveAllGrenadeEffects();
        });

        // EventPlayerChat (game event "player_chat") est un événement "après coup" : il
        // se déclenche une fois le message déjà diffusé à tous les clients, donc
        // HookResult.Handled dessus ne supprime rien (confirmé par un rapport de bug
        // CounterStrikeSharp — le message reste visible même en renvoyant Handled).
        // AddCommandListener sur "say"/"say_team" en revanche s'exécute AVANT que le
        // moteur ne traite/diffuse la commande : HookResult.Handled y bloque réellement
        // la commande, donc c'est le seul point d'accroche qui permette d'intercepter et
        // de masquer ".rethrow".
        AddCommandListener("say", OnSayCommand);
        AddCommandListener("say_team", OnSayCommand);
    }

    private HookResult OnSayCommand(CCSPlayerController? player, CommandInfo info)
    {
        var text = info.GetArg(1).Trim();
        if (player == null || !player.IsValid || player.IsBot)
            return HookResult.Continue;

        // Corrige un mismatch map serveur / lineup depuis le chat, sans passer par
        // l'app (voir aussi le hotkey F7 côté app, qui vise le même besoin en
        // mémorisant la map du dernier mismatch détecté). Pas de correspondance
        // exacte comme .rethrow/.clearnades ci-dessous : la map est un argument
        // libre, donc on parse le préfixe plutôt que de passer par le switch.
        const string changelevelPrefix = ".changelevel ";
        if (text.StartsWith(changelevelPrefix, System.StringComparison.OrdinalIgnoreCase))
        {
            var mapName = text[changelevelPrefix.Length..].Trim();
            Console.WriteLine($"[LineupCapturePlugin] .changelevel {mapName} reçu de {player.PlayerName}");
            Server.ExecuteCommand($"changelevel {mapName}");
            return HookResult.Handled; // masque la commande du chat des autres joueurs
        }

        switch (text.ToLowerInvariant())
        {
            case ".rethrow":
                // sv_rethrow_last_grenade est une commande native sv_cheats parfaitement
                // fonctionnelle, mais un client connecté ne peut pas l'exécuter lui-même :
                // elle n'est pas marquée FCVAR_CLIENT_CAN_EXECUTE (confirmé en jeu : "Client
                // Novanef(0) tried to execute command sv_rethrow_last_grenade but it is not
                // marked FCVAR_CLIENT_CAN_EXECUTE"). ExecuteClientCommandFromServer contourne
                // cette restriction en l'exécutant dans le contexte du joueur depuis le
                // serveur — plus simple et plus fiable que reconstruire une grenade à la main
                // (tenté avant : la reconstruction manuelle butait sur des signatures mémoire
                // natives fragiles et spécifiques à un build, en plus d'être plus complexe
                // que nécessaire).
                Console.WriteLine($"[LineupCapturePlugin] .rethrow reçu de {player.PlayerName}");
                player.ExecuteClientCommandFromServer("sv_rethrow_last_grenade");
                return HookResult.Handled; // masque le ".rethrow" du chat des autres joueurs

            case ".clearnades":
                Console.WriteLine($"[LineupCapturePlugin] .clearnades reçu de {player.PlayerName}");
                RemoveAllGrenadeEffects();
                return HookResult.Handled; // masque le ".clearnades" du chat des autres joueurs

            case ".botplace":
                Console.WriteLine($"[LineupCapturePlugin] .botplace reçu de {player.PlayerName}");
                PlaceBotOnPlayer(player);
                return HookResult.Handled; // masque le ".botplace" du chat des autres joueurs

            default:
                return HookResult.Continue;
        }
    }

    // Place le bot le plus éloigné de la même équipe que le joueur exactement où celui-ci se
    // trouve (position, angle, crouch, arme/grenade en main) ; en ajoute un via bot_add_t/
    // bot_add_ct si son équipe n'en a aucun. Technique reprise d'OpenPrefirePrac
    // (github.com/lengran/OpenPrefirePrac, plugin de practice CS2 en production réelle),
    // seul exemple trouvé qui force fiablement le crouch d'un bot :
    // - `CCSPlayerPawn.MovementServices` est typé `CPlayer_MovementServices` (classe de
    //   base) mais l'objet réel est un `CCSPlayer_MovementServices`, qui expose `DuckAmount`
    //   (absent de la classe de base — confirmé par reflection sur le SDK) ; on le récupère
    //   en reconstruisant le wrapper depuis le même `Handle`.
    // - `CCSPlayerPawn.Bot.IsCrouching` (le bot IA natif, présent uniquement sur les pawns
    //   de bot) doit aussi être positionné, sinon l'IA du bot peut re-redresser le pawn.
    // - Les deux sont appliqués via `AddTimer` (0.05s puis 0.1s) plutôt qu'immédiatement,
    //   comme dans OpenPrefirePrac — écrire ces champs dans le même tick que `Teleport()`
    //   n'a pas semblé fiable pour eux (raison exacte non documentée côté OpenPrefirePrac,
    //   repris tel quel par prudence plutôt que de re-tester une variante plus simple).
    // Non testé en conditions réelles sur ce projet (pas de bot connecté au moment de
    // l'implémentation) — à vérifier en jeu, voir CLAUDE.md "Points non encore vérifiés".
    // bot_add_t/bot_add_ct ajoutent un bot à l'équipe demandée (repris d'OpenPrefirePrac) ;
    // il n'existe pas de commande bot_add générique prenant l'équipe en paramètre.
    private const int MaxBotAddAttempts = 4;

    private void PlaceBotOnPlayer(CCSPlayerController player, int botAddAttempt = 0)
    {
        var humanPawn = player.PlayerPawn.Value;
        if (humanPawn?.AbsOrigin is null || humanPawn.EyeAngles is null)
            return;

        var origin = humanPawn.AbsOrigin;
        var team = player.Team;
        var bot = Utilities.GetPlayers()
            .Where(p => p is { IsValid: true, IsBot: true, PawnIsAlive: true } && p.Team == team
                        && p.PlayerPawn.Value?.AbsOrigin != null)
            .OrderByDescending(p => DistanceSquared(p.PlayerPawn.Value!.AbsOrigin!, origin))
            .FirstOrDefault();

        var botPawn = bot?.PlayerPawn.Value;
        if (bot is null || botPawn is null)
        {
            if (botAddAttempt >= MaxBotAddAttempts)
            {
                Console.WriteLine($"[LineupCapturePlugin] .botplace : impossible d'obtenir un bot dans l'équipe {team} (bot_add_* sans effet après {MaxBotAddAttempts} tentatives)");
                return;
            }

            // Aucun bot dans l'équipe du joueur : on en ajoute un, puis on retente le
            // placement une fois qu'il a rejoint (le spawn n'est pas synchrone — même délai
            // de 0.5s qu'OpenPrefirePrac avant de manipuler un bot fraîchement ajouté).
            Server.ExecuteCommand(team == CsTeam.Terrorist ? "bot_add_t" : "bot_add_ct");
            AddTimer(0.5f, () => PlaceBotOnPlayer(player, botAddAttempt + 1));
            return;
        }

        // Sans ça, le bot continue de bouger et de tourner la tête selon sa propre IA
        // (poursuite d'ennemi mémorisé, chemin de patrouille, visée...) juste après le
        // placement — confirmé en conditions réelles. Deux mécanismes combinés :
        // - MOVETYPE_NONE fige la position exactement là où on la met, sans aucune
        //   simulation physique — MOVETYPE_VPHYSICS (technique d'origine d'OpenPrefirePrac,
        //   utilisée pour ses bots-cibles fraîchement spawnés) laisse le moteur physique
        //   chercher un repos, ce qui a fait flotter légèrement le bot au-dessus du sol ici
        //   (bot repositionné en pleine partie, pas à l'instant du spawn comme chez eux).
        // - `Bot.IsSleeping` (champ natif CCSBot, trouvé par reflection sur le SDK, sans
        //   équivalent connu côté OpenPrefirePrac) coupe la prise de décision de l'IA
        //   (combat, patrouille, visée) sans tuer le bot — nécessaire ici puisqu'on agit sur
        //   un bot déjà vivant et actif, contrairement à OpenPrefirePrac qui figeait toujours
        //   un bot juste après son spawn, avant que son IA ne s'engage.
        FreezeBot(botPawn);
        botPawn.Bot!.IsSleeping = true;

        // Teleport() penche tout le corps/hitbox dès qu'un pitch non nul est passé (même
        // limitation moteur documentée pour la téléportation du joueur, voir CLAUDE.md et
        // HttpApiServer.TeleportPlayer — confirmée aussi sur un bot en conditions réelles,
        // corps tourné selon un axe horizontal). Un bot est un "fake client" (FL_FAKECLIENT)
        // et non un vrai joueur sans client réseau, donc setpos/setang via
        // ExecuteClientCommandFromServer — la solution qui fonctionne pour le joueur humain,
        // un chemin de code natif différent de Teleport() — s'applique de la même façon.
        var posStr = FormattableString.Invariant($"{origin.X} {origin.Y} {origin.Z}");
        var angStr = FormattableString.Invariant($"{humanPawn.EyeAngles.X} {humanPawn.EyeAngles.Y} 0");
        bot.ExecuteClientCommandFromServer($"setpos {posStr}");
        bot.ExecuteClientCommandFromServer($"setang {angStr}");

        var isCrouching = new CCSPlayer_MovementServices(humanPawn.MovementServices!.Handle).Ducked;
        var botMovement = new CCSPlayer_MovementServices(botPawn.MovementServices!.Handle);
        AddTimer(0.05f, () => botMovement.DuckAmount = isCrouching ? 1 : 0);
        AddTimer(0.1f, () => botPawn.Bot!.IsCrouching = isCrouching);

        var humanWeapon = humanPawn.WeaponServices?.ActiveWeapon.Value;
        if (humanWeapon != null)
        {
            // Sans mettre l'argent à 0, le bot se rachetait sa propre arme par défaut juste
            // après RemoveWeapons — son IA économique la lui rend aussitôt. Technique
            // reprise d'OpenPrefirePrac (`SetMoney(bot, 0)` avant `RemoveWeapons`/
            // `GiveNamedItem`).
            SetBotMoney(bot, 0);
            bot.RemoveWeapons();
            bot.GiveNamedItem(GetSpawnDesignerName(humanWeapon));
        }
    }

    // Certaines paires d'armes ont un classname moteur commun UNE FOIS SPAWNÉES (le jeu le
    // renomme après coup pour l'I/O — documenté sur le Valve Developer Wiki : "There are
    // weapon classes whose entities initially have an identical classname keyvalue after
    // being spawned, even though they were created from different classnames", ex.
    // weapon_mp5sd/weapon_mp7 deviennent tous deux "weapon_mp7", pareil pour m4a1/m4a1-s,
    // hkp2000/usp-s, deagle/r8, et tous les couteaux sauf le couteau par défaut).
    // `CBasePlayerWeapon.DesignerName` lu après spawn renvoie donc systématiquement ce nom
    // déjà fusionné ("weapon_m4a1" que ce soit un m4a4 ou un m4a1-s) — le repasser tel quel
    // à `GiveNamedItem` ne peut redonner que la variante de base. Le nom d'origine (celui
    // qui déterminait le vrai modèle/comportement à la création, avant la fusion) reste
    // lisible sur la donnée statique de l'arme (`VData`, le script de l'arme chargé une
    // fois par le jeu, indépendant du renommage par-entité) — plus général qu'une table
    // écrite à la main par paire connue.
    private static string GetSpawnDesignerName(CBasePlayerWeapon weapon)
        => weapon.GetVData<CCSWeaponBaseVData>()?.Name ?? weapon.DesignerName;

    private static void SetBotMoney(CCSPlayerController bot, int amount)
    {
        var moneyServices = bot.InGameMoneyServices;
        if (moneyServices is null)
            return;

        moneyServices.Account = amount;
        Utilities.SetStateChanged(bot, "CCSPlayerController", "m_pInGameMoneyServices");
    }

    private static void FreezeBot(CCSPlayerPawn botPawn)
    {
        botPawn.MoveType = MoveType_t.MOVETYPE_NONE;
        Schema.SetSchemaValue(botPawn.Handle, "CBaseEntity", "m_nActualMoveType", (byte)MoveType_t.MOVETYPE_NONE);
        Utilities.SetStateChanged(botPawn, "CBaseEntity", "m_MoveType");
    }

    private static float DistanceSquared(Vector a, Vector b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        var dz = a.Z - b.Z;
        return dx * dx + dy * dy + dz * dz;
    }

    // Même liste et même méthode de suppression (.Remove(), pas juste un masquage de
    // transmission) que pendant une capture — voir le commentaire sur HideEffectsForCapture
    // ci-dessus pour le détail de pourquoi .Remove() est nécessaire pour la fumée/le feu
    // déjà détonés. Ici en un seul passage immédiat (pas de boucle par tick), puisqu'il
    // s'agit d'un nettoyage ponctuel à la demande plutôt que d'un état continu.
    private static void RemoveAllGrenadeEffects()
    {
        foreach (var name in EffectDesignerNames)
        {
            foreach (var entity in Utilities.FindAllEntitiesByDesignerName<CBaseEntity>(name))
                entity.Remove();
        }
    }

    public override void Unload(bool hotReload)
    {
        _server?.Stop();
    }
}
