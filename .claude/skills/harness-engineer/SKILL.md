---
name: harness-engineer
description: Améliore le harness du comptoir (CLAUDE.md, skills, agents, mémoire d'équipe, instructions du projet) à partir des sessions récentes, mesure la forme de ses fichiers et programme un contrôle de chaque changement. Écrit un audit, l'applique, ouvre la PR. Déclencheurs : « harness-engineer », « améliore le harness », « rapatrie les mémoires dans le dépôt ».
---

# harness-engineer

Le harness, c'est tout ce qui entoure le modèle : les fichiers qu'un agent lit
avant d'agir, les limites qu'on lui donne, les contrôles qui le corrigent
après. Le modèle ne change pas d'une session à l'autre ; **le harness, si, et
c'est le seul levier qu'on tient**. Quand un agent fait deux fois la même
erreur, c'est le harness qui a un défaut, pas l'agent ([Fowler](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)).

Tu relis le harness à la lumière de ce qui s'est passé : pars de ce que les
sessions ont produit, nomme le défaut, corrige-le là où il sera lu, et mesure
pour que la prochaine passe sache si ça a aidé. Tu relis ce qui a fait écrire
le code, pas le code, et un bug de l'app va dans sa propre issue. La méthode
vient des textes de [`references.md`](references.md).

## Où ça tourne

Chaque session sur ce dépôt est une **session cloud de Claude Code pilotée
depuis l'app**, dans un conteneur cloné à neuf et jeté ensuite.

- **Seul survit ce qui est poussé, déposé ou mémorisé.** L'audit est commité
  sur la branche, les suites sont des issues GitHub étiquetées `harness`, les
  leçons sur la conversation vont en mémoire d'équipe.
- **Les sessions passées ne sont pas sur le disque.** Elles se lisent avec les
  outils de sessions distantes, les fils du projet avec les outils du projet
  ([`evidence.md`](evidence.md)). GitHub se joint avec les outils GitHub MCP.
- **Le propriétaire relit sur son téléphone.** La description de la PR est
  l'endroit où il accepte ou refuse chaque changement, donc elle se suffit ;
  la réponse dans le fil reste courte.
- **Il n'y a pas de machine locale à configurer** : pas de status line, pas de
  `~/.claude/CLAUDE.md`, pas de `CLAUDE.local.md`. Ce dont le conteneur a
  besoin au démarrage relève du script de setup de l'environnement ou d'un
  hook SessionStart.

## Le harness, pièce par pièce

Ce qui décide où va un fait, c'est **quand chaque fichier est lu**. Une règle
dans un skill n'existe pas pour une session qui ne l'invoque pas ; une règle
dans `CLAUDE.md` coûte à chaque tour de chaque session.

| Pièce | Lue quand |
| --- | --- |
| [`CLAUDE.md`](../../../CLAUDE.md) : conventions pour tout travail sur le dépôt | chaque session, en entier |
| [`.claude/skills/*/SKILL.md`](../) : une façon de faire une chose | à l'invocation ; ses fichiers voisins quand une étape les nomme |
| [`.claude/agents/*.md`](../../agents/) : un sous-agent et sa consigne | quand un skill le lance |
| `.claude/settings.json` : hooks et permissions que le harness exécute lui-même | chaque session sur un clone |
| les instructions du projet, dans les réglages du projet Claude ; leur texte est dans le prompt système d'une session du projet | chaque session lancée depuis le projet |
| la mémoire d'équipe, `MEMORY.md` comme index, au chemin que donne le prompt système | l'index à chaque session, un fichier quand il est pertinent |
| [`e2e/`](../../../e2e/) et [`.github/workflows/`](../../../.github/workflows/) : contrôles après coup | chaque pull request |

## Les trois questions

Les trois piliers de [harnessengineering.academy](https://harnessengineering.academy/blog/what-is-harness-engineering-introduction-2026/),
posés à chaque défaut. Un défaut a presque toujours une réponse, et elle
nomme le remède.

1. **Contexte : l'agent avait-il la bonne chose sous les yeux au bon
   moment ?** Le remède est de *déplacer* ou de *raccourcir*, rarement
   d'écrire plus.
2. **Contraintes : qu'interdit la prose que rien n'empêche ?** Une règle
   enfreinte deux fois malgré sa prose demande un contrôle après l'action (un
   test, un check qui échoue), pas une phrase de plus avant.
3. **Entropie : qu'est-ce qui a cessé d'être vrai ?** Un chemin disparu, un
   fichier nommé de deux façons, une mémoire qui cite une règle retirée, une
   anecdote dont le défaut est corrigé.

## Entrée

**Sans rien** : la passe rétrospective, sur la fenêtre depuis le dernier
audit (le plus récent `.claude/audits/*-harness*.md` sur `origin/main`),
sinon sept jours, sinon ce qu'on te donne. Une passe coupée avant sa PR ne se
reprend pas : sa branche est abandonnée et la tienne repart des preuves. Comme
tout travail ici, la passe trouve ou ouvre d'abord son issue, « Passe du
harness AAAA-MM-JJ » ; lancée par la revue périodique, son issue est
`periodic-review` et sa PR dit `Refs #n` (`CLAUDE.md` § Revue périodique).

**Avec une demande**, une capacité qui manque au harness : la demande est la
preuve du besoin. Cherche comment la chose se fait aujourd'hui et ce que ça
coûte, ce que la demande contredit dans le harness (à réécrire, pas à
rapiécer d'une exception), ce qui la ferait mal tourner, et la base de mesure.
« Une nouvelle règle demande deux occurrences » ne tient pas contre une
demande explicite, mais tient pour ce que tu serais tenté d'ajouter à côté.

## La passe

1. **Impact des passes précédentes.** Pour chaque issue `harness` ouverte
   dont la date de contrôle est échue, lance sa mesure, écris le résultat
   (*tenu*, *pas tenu*, *pas mesurable*) sur l'issue et dans le premier
   tableau de l'audit, et ferme-la si c'est tenu. *Pas tenu* est une
   trouvaille de cette passe, remédiée par le repli de l'issue ou un
   contrôle ; *pas mesurable* deux fois la ferme comme non prévue.
2. **Inventaire et forme.** `python3 .claude/skills/harness-engineer/scripts/shape.py --since <début de fenêtre>`,
   puis `--duplicates`. Un `!` est une trouvaille, pilier contexte. Seuils
   dans [`how-we-write.md`](how-we-write.md), autres mesures dans
   [`measures.md`](measures.md).
3. **Rassemble les preuves** de la fenêtre avec [`evidence.md`](evidence.md)
   : sessions, fils, PR, issues, runs de CI, mémoire d'équipe, instructions
   du projet. Note chaque fait avec sa source exacte avant de l'interpréter.
4. **Diagnostique.** Les trois questions, puis **un** remède : *écrire*,
   *déplacer*, *raccourcir*, *contrôler*, *corriger*, *fusionner*,
   *supprimer*, *rapatrier* (une mémoire ou une instruction du projet dans un
   fichier versionné), *mesurer*. Où il va :
   [`where-each-fact-goes.md`](where-each-fact-goes.md). **Une nouvelle règle
   demande deux occurrences**, ou une seule qui a coûté une PR ; une règle
   rapatriée n'en demande aucune.
5. **Écris l'audit** dans `.claude/audits/AAAA-MM-JJ-harness.md`
   (`-harness-<sujet>.md` pour une demande) **comme premier commit de la
   passe**, au format de [`audit-template.md`](audit-template.md) ; une
   trouvaille *mesurer* vit dans ce commit. Chaque trouvaille appliquée porte
   son **impact attendu** : mesure, base datée, seuil, date de contrôle,
   repli.
6. **Applique** sur la branche de la session, un commit par trouvaille, en
   suivant [`how-we-write.md`](how-we-write.md) ; pour scinder un fichier,
   [`splitting-a-file.md`](splitting-a-file.md). Appliqué sans demander :
   l'entropie, les déplacements, les coupes, et **toute mémoire et instruction
   du projet que le dépôt ne dit pas déjà**, rapatriée dans un skill ou
   `CLAUDE.md`. Proposé, pas écrit : retirer une règle,
   `.claude/settings.json`, un hook SessionStart, le script de setup, un
   changement des instructions du projet.
7. **Vérifie.** Rejoue l'échec : au tour où le défaut est arrivé, le fichier
   changé aurait-il été chargé, avec la règle assez haut pour être lue ?
   Lance chaque commande écrite ou changée dans le harness dans les deux sens,
   condition vraie et fausse. Puis [`measures.md` § Contrôles](measures.md#contrôles),
   et toute la suite e2e si la passe a touché `e2e/`.
8. **Pousse et ouvre la PR** vers `main` avec les outils GitHub MCP, qui
   ferme l'issue de la passe (`Closes #n`, ou
   `Refs #n` pour une revue périodique). Sa description a une ligne par
   trouvaille, avec sa preuve et son commit, pour juger chacune depuis le
   téléphone. La revue en boucle la relit ensuite, comme toute PR.
9. **Dépose ce qui ne peut se faire que plus tard** en issues `harness` :
   **une issue `Contrôle : <sujet>` par trouvaille appliquée**, avec la
   requête qui donne la mesure, la base, le seuil, la date de contrôle (une
   semaine après la passe, sauf si la mesure demande plus de sessions) et le
   repli ; une mémoire à vider après le merge ; un contrôle que cette fenêtre
   n'a pas pu faire. Si le propriétaire veut qu'un contrôle tourne tout seul,
   propose une tâche planifiée ponctuelle à sa date et ne la crée que sur sa
   parole.

## Ce que tu rends

Une réponse courte dans le fil qui pointe vers la PR : trouvailles appliquées
et proposées, les deux ou trois qui changent le plus, une ligne d'impact
attendu par trouvaille appliquée, les mémoires à vider après le merge. Le
reste est dans l'audit et la PR ; ce qui reste après le merge est une issue,
pas une phrase.

## Garde-fous

- **Aucune trouvaille sans preuve rassemblée dans cette passe.** Ce que tu
  n'as pas pu ouvrir va sous « Ce que je n'ai pas pu vérifier ».
- **Ne touche ni l'app, ni le README, ni d'autres issues que celle de la
  passe.** Tu écris sous `.claude/`, dans `CLAUDE.md` et en mémoire d'équipe ;
  dans `e2e/` seulement quand le remède d'une trouvaille est un test, avec la
  suite verte.
- **Corrige sur place, déplace des sections, coupe ; ne réécris pas les
  phrases.** Une scission prouve que chaque paragraphe a un sort
  ([`splitting-a-file.md`](splitting-a-file.md)). Retirer une règle se
  propose, avec ce que tu as cherché et sur quelle période.
- **Une mémoire ne se vide qu'après le merge**, une fois son contenu sur
  `main`, en la réduisant à une ligne qui pointe vers le fichier versionné,
  jamais en la supprimant d'un coup ; les instructions du projet, en
  proposant la même coupe.
- **Lis les sessions par pages filtrées ; ton contexte ne garde que les
  preuves.** Une session, ce sont des centaines d'événements ; ne demande que
  les sortes dont tu as besoin.
