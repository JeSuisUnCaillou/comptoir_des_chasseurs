---
name: revue-architecture
description: Relit tout le code du Comptoir des chasseurs sur main pour l'architecture et l'écart avec la doc, et ouvre une issue par trouvaille confirmée ; ne change aucun code. Proposée au propriétaire toutes les 20 PR mergées (`CLAUDE.md` § Revue périodique). Déclencheurs : « revue-architecture », « relis tout le code », « revue d'architecture ».
---

# revue-architecture

Le relecteur architecte de la revue en boucle voit le diff d'une branche.
L'écart réparti sur beaucoup de PR, un module qui ne cesse de grossir, un
document devenu faux une ligne à la fois, ne se voit que de l'ensemble. Cette
revue relit le code tel qu'il est sur `main` et ne change aucun code : ce
qu'elle trouve devient des issues, que le propriétaire ordonne comme tout
autre travail (`CLAUDE.md` § Suivre le travail dans les issues).

## La revue

1. **Place-toi sur `main`.** `git fetch -q origin main`, puis
   `git checkout --detach origin/main`, une fois poussée toute branche à toi.
   Fini quand `git status` montre un `HEAD` détaché sur `origin/main`.

2. **Rassemble ce qui est déjà connu**, avec les outils GitHub MCP : les
   issues étiquetées `architecture`, ouvertes et fermées, dont le rapport de
   la revue précédente (« Revue d'architecture AAAA-MM-JJ ») et les
   trouvailles qu'elle a rejetées. Fini quand tu tiens cette liste.

3. **Fais relire par les deux agents** en parallèle, avec l'outil Agent, au
   premier plan : `subagent_type: "relecteur-architecte"` et
   `subagent_type: "relecteur-bugs"` (`.claude/agents/`). Le message de
   chacun est la partie commune ci-dessous, puis la sienne, puis les deux
   listes de l'étape 2 sous « Déjà connu ; n'en relève une à nouveau qu'avec
   un fait qu'elle n'a pas pris en compte ». Fini quand les deux ont rendu.

4. **Tranche chaque trouvaille toi-même** au code qu'elle cite : confirmée,
   rejetée avec une ligne de pourquoi, ou un choix du propriétaire (un
   comportement que `docs/comportement.md` ne tranche pas, une règle métier). Fini quand
   chaque trouvaille a l'un des trois.

5. **Ouvre une issue par trouvaille confirmée**, étiquetée `architecture` :
   le titre dit ce qui ne va pas en mots simples ; le corps donne
   `fichier:ligne`, le cas où ça mord, le remède et sa taille. Une trouvaille
   qui correspond à une issue ouverte y reçoit un commentaire si elle a
   grossi, sinon rien. Fini quand chaque trouvaille confirmée a son issue ou
   son commentaire.

6. **Rends compte** dans une issue « Revue d'architecture AAAA-MM-JJ »,
   étiquetée `architecture` et fermée aussitôt : les issues ouvertes, les
   choix laissés au propriétaire, et chaque trouvaille rejetée avec sa
   raison, que la prochaine revue lit à l'étape 2. Puis réponds au
   propriétaire avec son lien.

## Les messages aux relecteurs

La partie commune :

```
Relis tout le code, extrait sur origin/main dans le répertoire courant, pas
une branche. Rends aussi pour chaque trouvaille un remède avec sa taille.
```

**relecteur-architecte** :

```
Aussi : une fonction ou un fichier qui a grossi au-delà de ce qu'un lecteur
tient en tête ; une logique écrite deux fois ; un export que rien n'importe ;
un fichier de lib/ ou de app/ que plus rien n'utilise.
```

**relecteur-bugs**, qui fait ici la doc et les tests :

```
Cherche plutôt où les documents et le code divergent : docs/comportement.md
(ce que fait l'app, rôles), README.md (lancer, tester, déployer), CLAUDE.md,
.env.example face aux variables que le code lit, lib/db/schema.ts face aux migrations de drizzle/.
Puis ce que docs/comportement.md décrit qu'aucun test de e2e/ ne pilote, et les tests qui
enfreignent CLAUDE.md § Tests de bout en bout (état interne lu,
waitForTimeout, données sans nom unique). Un fait écrit à deux endroits est
une trouvaille (CLAUDE.md § Un fait, une place).
```

## Garde-fous

- **Une issue s'ouvre sur du code cité**, jamais sur le résumé d'un
  relecteur.
- **Aucun changement de code, de doc ni de test ici** : chaque correction est
  sa propre issue, sa branche et sa revue en boucle, pour que le
  propriétaire choisisse l'ordre.
