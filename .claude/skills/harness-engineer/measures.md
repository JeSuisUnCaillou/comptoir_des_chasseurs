# Mesures

À lire aux étapes 1, 2 et 7 de la passe, et à l'étape 6 par
`splitting-a-file.md`. Chaque chiffre d'un audit vient d'une de ces commandes
ou requêtes ; un chiffre que rien ici ne rend n'entre pas dans une
trouvaille. Les bases datées vivent dans les audits, jamais ici.

## Sommaire

- La forme du harness
- Sessions et coût
- PR et CI
- Contrôles

## La forme du harness

```sh
python3 .claude/skills/harness-engineer/scripts/shape.py --since "$SINCE"   # une ligne par skill, `!` sur un seuil franchi
python3 .claude/skills/harness-engineer/scripts/shape.py --duplicates       # paragraphes trouvés dans deux fichiers
git log --since="$SINCE" --name-only --format= -- .claude CLAUDE.md | sort | uniq -c | sort -rn   # ce qui ne cesse d'être touché
```

Le clone neuf d'une session cloud peut être superficiel : si `git log`
s'arrête avant la fenêtre, `git fetch --unshallow origin main` d'abord.

Les seuils sont ceux de `how-we-write.md`. Un fichier du harness touché à
chaque session est le signe le plus sûr d'un problème de structure : on
ajoute une phrase là où une section devrait bouger, ou un contrôle la
remplacer.

## Sessions et coût

Depuis `list_sessions`, en gardant les sessions du comptoir de la fenêtre
(`evidence.md`) :

- **sessions** : leur nombre, par `origin` et par `status_bucket` ; une
  `failed` se lit.
- **coût** : `external_metadata.usage.cost_usd` par session, sa médiane et
  son total ; et `cache_write_tokens` face à `cache_read_tokens`, puisqu'une
  session qui réécrit sans cesse son cache est une session qui a attendu.
- **corrections du propriétaire** : lues à la main dans les événements `user`
  et les fils, jamais comptées par mot-clé.

## PR et CI

Avec les outils GitHub MCP :

- **pushes par PR** : les commits de chaque PR mergée ou fermée dans la
  fenêtre (`pull_request_read`, méthode `get_commits`), médiane et max.
- **rouge puis vert** : les runs de `ci.yml` de chaque PR (`actions_list`),
  et ce qui les a remis au vert, d'après le commit suivant.
- **issues `harness` ouvertes** en fin de fenêtre (`list_issues`,
  `labels: ["harness"]`), et celles dont la date de contrôle est passée.

## Contrôles

À lancer à l'étape 7, tous, pendant la passe :

```sh
# chemins cités par le harness et absents du dépôt, ce skill exclu
# puisqu'il cite des chemins en exemple ; ce qui suit un ~/ est hors du dépôt
grep -ohE '(^|[^~/A-Za-z])(\.claude|e2e|app|components|lib|drizzle|scripts|docs|\.github)/[A-Za-z0-9_./*()-]+' CLAUDE.md \
  $(ls .claude/agents/*.md .claude/skills/*/*.md 2>/dev/null | grep -v harness-engineer) \
  | sed -E 's/^[^.a-z]//; s/[.,)]*$//' | grep -v '\*' | sort -u \
  | while read p; do [ -e "$p" ] || echo "absent : $p"; done
# les liens markdown relatifs se résolvent depuis le dossier de chaque fichier ; les liens web sont sautés
for f in CLAUDE.md .claude/agents/*.md .claude/skills/*/*.md; do d=$(dirname "$f")
  grep -oE '\]\([^)#][^)]*\)' "$f" | grep -vE '^\]\(https?:' | sed -E 's/^\]\((.*)\)$/\1/; s/#.*//' \
  | while read l; do [ -z "$l" ] || [ -e "$d/$l" ] || echo "$f -> $l"; done; done
# les voisins sont liés à un niveau : un voisin qui lie un autre voisin
grep -lE '\]\([a-z-]+\.md\)' .claude/skills/*/*.md | grep -v SKILL.md
# la forme
python3 .claude/skills/harness-engineer/scripts/shape.py
```

Un modèle (`AAAA-MM-JJ-`, `<nom>`) sort naturellement du premier contrôle ; ce
qui compte, c'est un vrai chemin qui n'existe plus.
