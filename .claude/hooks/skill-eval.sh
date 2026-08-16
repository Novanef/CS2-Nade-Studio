#!/bin/bash
# Déclenché sur UserPromptSubmit. Analyse le prompt et injecte les skills pertinents.
# Inspiré de waldencui/claude-code-django et ChrisWiles/claude-code-showcase.

set -euo pipefail

input=$(cat 2>/dev/null) || exit 0
prompt=$(echo "$input" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('prompt', '').lower())
except:
    pass
" 2>/dev/null) || exit 0
[[ -z "$prompt" ]] && exit 0

suggestions=()

match() {
  local name="$1"; local hint="$2"; shift 2
  for kw in "$@"; do
    if echo "$prompt" | grep -qi "$kw"; then
      suggestions+=("- **$name** : $hint")
      return
    fi
  done
}

# Agents
match "service-writer" \
  "Écrire un service Django avec pattern Protocol/fake-gateway" \
  "service" "protocol" "gateway" "logique métier" "business logic" "ValueError"

match "test-writer" \
  "Écrire des tests avec fakes et freeze_time" \
  "test" "tests" "pytest" "testcase" "assertion" "fake" "tester"

match "planner" \
  "Planifier avant de coder : décomposer le ticket, lister fichiers et cas métier" \
  "planifie" "décompose" "jira" "avant de coder" "avant d'implémenter" "architecture du ticket"

match "reviewer" \
  "Reviewer le code avant commit ou PR" \
  "revoir le code" "avant de commit" "avant la pr" "vérifie le code" "code review"

# Skills slash-commands
match "/new-feature" \
  "Workflow CRUD complet : model → serializer → service → viewset → tests" \
  "endpoint" "crud" "viewset" "serializer" "nouveau modèle" "nouvelle entité"

match "/new-command" \
  "Workflow management command Django + CronJob K8s" \
  "management command" "cron" "commande" "planifié" "scheduled" "cronjob"

match "/feature" \
  "Workflow complet ticket Jira → branche → TDD → PR" \
  "ticket" "jira" "implémenter" "implement" "fonctionnalité"

match "/debug" \
  "Débogage systématique (observer → isoler → corriger → prévenir)" \
  "bug" "erreur" "error" "exception" "traceback" "ne fonctionne pas" "fails" "debug"

match "/logs" \
  "Conventions de logging (niveaux, format, ce qu'il ne faut pas logger)" \
  "log" "logs" "logging" "logger" "trace" "audit"

match "/add-gateway" \
  "Ajouter un gateway vers une base externe (temporal_data, watt_ee ou nouvelle)" \
  "gateway" "external" "temporal_data" "watt_ee" "base externe"

match "/safe-migration" \
  "Patterns zero-downtime PostgreSQL (NOT NULL, index concurrent, rename, drop column)" \
  "zero-downtime" "not null" "rename column" "drop column" "supprimer colonne" "index concurrent" "lock table" "alter table"

match "/catchup" \
  "Résumer tous les changements de la branche courante" \
  "catchup" "résume" "qu'est-ce qui a changé" "branche" "branch"

match "/caveman" \
  "Activer le mode compression tokens (lite/full/ultra)" \
  "caveman" "compresse" "tokens" "trop long" "trop verbeux" "raccourcis"

[[ ${#suggestions[@]} -eq 0 ]] && exit 0

context="Skills disponibles pour cette tâche :"$'\n'
for s in "${suggestions[@]}"; do
  context+="$s"$'\n'
done

python3 -c "
import json, sys
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'UserPromptSubmit',
    'additionalContext': sys.argv[1]
  }
}))
" "$context"