#!/bin/sh
# Stop hook: keeps a session from ending its turn on a pushed branch that has
# changed since its last review loop. revue-en-boucle writes the reviewed head
# to .git/revue-en-boucle/<branch>, outside the repository's files.
# It stays out of the way on main, with uncommitted or unpushed work, and on a
# branch with nothing to review.

input=$(cat)

# The hook already refused once in this turn: let it end, so it never loops.
printf '%s' "$input" | grep -q '"stop_hook_active" *: *true' && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null) || exit 0
[ "$branch" = main ] && exit 0
[ -z "$(git status --porcelain 2>/dev/null)" ] || exit 0
pushed=$(git rev-parse -q --verify "refs/remotes/origin/$branch" 2>/dev/null) || exit 0
[ "$pushed" = "$(git rev-parse HEAD)" ] || exit 0
base=$(git merge-base HEAD origin/main 2>/dev/null) || exit 0
git diff --quiet "$base" HEAD && exit 0

file="$(git rev-parse --git-dir)/revue-en-boucle/$(printf '%s' "$branch" | tr / -)"
reviewed=$(cat "$file" 2>/dev/null)
if [ -n "$reviewed" ] && git cat-file -e "$reviewed^{commit}" 2>/dev/null \
  && git diff --quiet "$reviewed" HEAD; then
  exit 0
fi

printf '%s\n' '{"decision": "block", "reason": "Cette branche est poussée et a changé depuis sa dernière revue. Avant de la rendre, lance Skill(skill: \"revue-en-boucle\") ; elle note la tête relue dans .git/revue-en-boucle/. Si la pull request de cette branche est déjà mergée ou fermée, dis-le et termine le tour."}'
