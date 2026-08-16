---
name: caveman
description: Activate compressed output mode to save tokens. Use when you want Claude to respond in terse, compressed prose for the rest of the session. Three intensity levels: lite, full, ultra.
---

# Caveman — mode compression tokens

Passer en mode sortie compressée pour le reste de la session.

## Niveaux

Indique le niveau voulu (défaut : **lite**) :

### `lite`

- Supprimer politesse, transitions, confirmations inutiles
- Listes plutôt que phrases
- Garder structure markdown et blocs code

### `full`

- Style télégraphique : sujet-verbe-objet
- Zéro redondance
- Exemples omis sauf si demandés

### `ultra`

- Caveman prose : "Model save. Migration run. Test pass."
- Bulletpoints d'une ligne max
- Noms de symboles seuls si contexte clair

## Règles non-négociables

Ces situations **désactivent automatiquement** la compression le temps de la réponse :

- Action irréversible (suppression, force-push, drop table, reset --hard)
- Information de sécurité (credentials, CVE, permissions)
- Désambiguïsation nécessaire (plusieurs interprétations possibles)
- L'utilisateur demande une explication

## Activation

Confirmer avec une seule ligne, puis appliquer immédiatement :

```
caveman mode: [lite|full|ultra] — économie ~X% tokens
```

## Désactivation

`/caveman off` ou "retourne au mode normal" → reprendre le style standard.
