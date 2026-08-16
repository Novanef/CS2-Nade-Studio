using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;

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
            if (!HideEffectsForCapture)
                return;

            foreach (var name in EffectDesignerNames)
            {
                foreach (var entity in Utilities.FindAllEntitiesByDesignerName<CBaseEntity>(name))
                    entity.Remove();
            }
        });
    }

    public override void Unload(bool hotReload)
    {
        _server?.Stop();
    }
}
