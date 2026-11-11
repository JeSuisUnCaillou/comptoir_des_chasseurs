---
name: revue-en-boucle
description: Relit une branche poussée avec deux relecteurs neufs, corrige ce qu'ils confirment, et recommence tant qu'une correction bloquante a été faite. Réclamée par le hook Stop une fois le travail d'une branche poussé. Déclencheurs : « revue-en-boucle », « relis cette branche », « relis et corrige cette PR ».
---

# revue-en-boucle

Deux relecteurs neufs voient la branche sans tes raisons de l'avoir écrite ;
tu tranches et tu corriges, puisque c'est toi qui as le contexte. Une passe
dans le cas courant, trois au plus. Le changement est toute la branche :
`git fetch -q origin main && git diff origin/main...HEAD`.

1. **Lance les deux relecteurs** en parallèle, avec l'outil Agent, au premier
   plan : `relecteur-bugs` et `relecteur-architecte` (`.claude/agents/`),
   chacun avec « Relis la branche `<branche>`. » À partir de la deuxième
   passe, ajoute les trouvailles déjà rejetées et pourquoi.

2. **Tranche chaque trouvaille** sur le code qu'elle cite : confirmée (tu la
   corriges, de la façon la plus mécanique : supprimer ou renvoyer plutôt
   que réécrire), rejetée (une ligne de pourquoi), ou un choix du
   propriétaire (une règle métier que le README ne tranche pas : tu le lui
   laisses).

   **Bloquante** seulement si c'est du code et qu'un membre du comptoir, une
   session ou la CI le rencontrerait : un bug, un compte faux (stock, prix,
   registre), un accès qu'un rôle ne devrait pas avoir, un secret, une
   migration incompatible avec la prod pendant le build, un changement de
   comportement sans test e2e. Le reste (texte, style, code mal placé sans
   bug) se corrige sans relancer de passe.

3. **Si tu as touché du code**, lance la suite e2e (`CLAUDE.md` § Tests de
   bout en bout), puis pousse.

4. **Recommence seulement si une correction bloquante a été faite.** Une
   bloquante qui revient, ou une troisième passe qui en trouve encore :
   arrête de corriger sur place et laisse-la au propriétaire.

5. **Note la tête relue** pour le hook, hors du dépôt :
   `d="$(git rev-parse --git-dir)/revue-en-boucle"; mkdir -p "$d"; git rev-parse HEAD > "$d/$(git branch --show-current | tr / -)"`.

6. **Ce qui reste** (questions non tranchées, cas limites non couverts,
   trouvailles réelles hors sujet) : une issue chacun, sauf s'il en existe
   déjà une.

Puis merge ou attends le propriétaire selon `CLAUDE.md` § Qui merge.

## Ce que tu rends

Une ligne dans la description de la PR et dans ta réponse : combien de
passes, ce qu'elles ont corrigé, ce qui est laissé au propriétaire, les
issues ouvertes.

## Garde-fous

- Les deux relecteurs tournent à chaque passe, sur toute la branche.
- « Vérifié » ne se dit que de ce que tu as vu échouer puis passer.
- Les relecteurs n'écrivent rien (ni `git stash`, ni `git checkout`) : tu
  corriges dans la même copie.
