#!/usr/bin/env bash
# Synchronise l’historique Supabase quand les tables existent déjà.
# Versions = préfixe numérique du fichier (001, 014…), pas le nom complet.
#
# Prérequis : supabase login && supabase link --project-ref XXX
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP='^(019|020)$'

echo "→ Marquer comme appliquées (sans rejouer le SQL) :"
for f in supabase/migrations/*.sql; do
  base=$(basename "$f" .sql)
  version="${base%%_*}"
  if [[ "$version" =~ $SKIP ]]; then
    continue
  fi
  echo "  repair $version  ($base.sql)"
  supabase migration repair "$version" --status applied
done

echo ""
echo "→ Appliquer uniquement ce qui manque (souvent 019 + 020 appels) :"
supabase db push

echo ""
echo "→ État :"
supabase migration list
