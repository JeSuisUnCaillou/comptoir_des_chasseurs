---
name: revue-en-boucle
description: Relit une branche poussée avec deux relecteurs neufs, corrige ce qu'ils confirment, et recommence jusqu'à une passe sans rien de bloquant. Lancée par le hook Stop une fois le travail d'une branche poussé. Déclencheurs : « revue-en-boucle », « relis cette branche jusqu'à ce qu'elle soit propre », « relis et corrige cette PR ».
---

# revue-en-boucle

`relire → corriger → relire…` sur une branche dont le travail est commité et
poussé, jusqu'à ce qu'une passe ne confirme rien de bloquant. Deux relecteurs
neufs voient le changement sans tes raisons de l'avoir fait ; les corrections
restent à toi, qui as le contexte. Vite plutôt qu'en apparence complet : deux
relecteurs, une passe dans le cas courant, trois au plus.

## Quand elle tourne

Le hook `Stop` (`.claude/hooks/review-gate.sh`) refuse de finir un tour sur
une branche poussée qui diffère de `main` sans passe notée pour sa tête
actuelle, et nomme ce skill. Lance-la avant la réponse qui rend le travail,
pour que le hook n'ait rien à arrêter. La PR de la branche est ouverte avant
(`CLAUDE.md`).

Le changement est toujours toute la branche, `git diff origin/main...HEAD`
après `git fetch -q origin main`. Le fichier de revue est
`.claude/reviews/<branche>.md`, chaque `/` du nom de branche changé en `-` ;
chaque passe s'y ajoute.

## La boucle

1. **Lance les deux relecteurs** en parallèle, avec l'outil Agent, au premier
   plan : `subagent_type: "relecteur-bugs"` et
   `subagent_type: "relecteur-architecte"` (`.claude/agents/`). Le message de
   chacun : « Relis la branche `<branche>`. » puis, à partir de la deuxième
   passe : « Des passes précédentes ont rejeté ces trouvailles. N'en relève
   une à nouveau qu'avec un fait que la raison n'a pas pris en compte : »
   suivi des lignes rejetées du fichier de revue.

2. **Tranche chaque trouvaille toi-même.** Lis le code qu'elle cite,
   confirme-la ou rejette-la, classe-la avec [`bloquant.md`](bloquant.md).
   - Confirmée : corrige-la de la façon la plus mécanique, un commit par
     groupe.
   - Faux positif : laisse le code, une ligne pour dire pourquoi.
   - Elle demande un choix qui appartient au propriétaire (un comportement
     que le README ne tranche pas, une règle métier du comptoir) : ne corrige
     rien pour elle, et laisse-la au propriétaire dans la réponse.

3. **Écris la passe** dans le fichier de revue sous `# Passe n` : la tête
   relue, puis une ligne par trouvaille avec son sort (corrigée en `<sha>`,
   rejetée parce que…, laissée au propriétaire). Une passe sans trouvaille le
   dit.

4. **Lance la suite e2e** (`CLAUDE.md` § Tests de bout en bout) si une
   correction a touché du code, et pousse.

5. **Recommence seulement si une trouvaille bloquante a été corrigée.** Si
   une trouvaille bloquante revient là où une correction précédente aurait dû
   la fermer, ou si une troisième passe en trouve encore une, arrête de
   corriger sur place : trouve la règle qu'elle enfreint là où elle est
   possédée (README, `CLAUDE.md`), corrige-la, ou laisse-la au propriétaire.

6. **Ferme le fichier** : ajoute `Tête relue : <sha complet de HEAD>` en
   dernière ligne, commite le fichier de revue seul (`git show HEAD --stat`),
   pousse. Le hook lit cette ligne ; une branche inchangée depuis, hors de
   `.claude/reviews/`, n'a pas besoin d'une nouvelle passe.

7. **Ce qui part sans attendre le propriétaire.** Claude ne merge seul que
   la doc, les tests, le harness et les petits correctifs. Tout le reste
   attend que le propriétaire demande le merge de cette PR : une fois la
   boucle convergée, refais la preview si la tête a changé depuis
   l'ouverture de la PR, puis donne-lui le lien de la page à essayer sur la
   preview publiée sur la PR (`CLAUDE.md` § Donner un lien pour essayer),
   ce qu'il peut y essayer et les données à regarder, que la preview doit
   déjà contenir (même §), puis attends sa réponse, puisqu'il peut avoir des retours. Dans
   le doute, ça attend. Choisi par le propriétaire le 2026-11-10 : « ne
   merge pas des choses sans mon accord, montre moi à chaque fois une
   preview avant de merge », puis « les seules choses que tu peux merge
   tout seul sont la doc, les tests, et le harness, ou les petits fixs ».

   **Pour merger une PR qui part seule, ou dont le propriétaire a demandé
   le merge** :
   - Avant d'attendre, lis son état de merge (`pull_request_read`). Une PR
     en conflit avec `main` n'a pas de CI sur un nouveau push : merge `main`
     dedans, lance la suite, pousse, et refais un tour de boucle, pour que le
     fichier de revue se ferme sur le commit de merge.
   - Suis la PR (`subscribe_pr_activity`) **et** programme-toi un rappel
     avec `send_later` dans 3 minutes. Un tour qui finit en attendant la CI
     a toujours un rappel programmé : la fin du job e2e ne réveille pas la
     session, et un `check_suite.completed` peut arriver d'une autre suite
     finie avant le job (vu le 2026-11-10 sur #23 et #26 avec Vercel, que le
     propriétaire a dû réclamer ; `.claude/audits/2026-11-10-harness-ci.md`).
   - À chaque réveil, rappel ou événement, lis le check run « Build et tests
     e2e » de la tête (`pull_request_read`, `get_check_runs`). Vert : merge
     avec `merge_pull_request`, en squash (`CLAUDE.md` § Qui merge), avec
     `expectedHeadSha` égal au commit qui a fermé le fichier de revue, pour
     qu'un commit poussé après la revue ne soit jamais mergé sans relecture.
     Puis ferme l'issue de son `Closes #n` si le merge ne l'a pas fait
     (`CLAUDE.md` § Suivre le travail dans les issues). Puis compte les PR
     mergées dans `main` depuis la fermeture de la dernière issue
     `periodic-review` (ou depuis #6, qui a ajouté `.claude/`) ; à 20 ou
     plus, sans issue `periodic-review` ouverte, dis au propriétaire dans ta
     réponse que la revue périodique est due, avec le nombre
     (`CLAUDE.md` § Revue périodique ; personne ne l'avait lancée après
     50 PR, `.claude/audits/2026-11-11-harness.md`).
     En file ou en cours : un nouveau rappel dans 2 minutes. Rouge : c'est
     une correction, et la boucle repart.
   - Toujours pas fini 20 minutes après le push : dis au propriétaire quel
     check bloque, et arrête les rappels.

8. **Pèse les restes.** Liste ce que le travail laisse ouvert : les questions
   que tu t'es posées ou as posées au propriétaire sans les trancher, les
   tâches repoussées, les cas limites qu'un relecteur a soulevés et que cette
   PR ne couvre pas, les trouvailles rejetées comme hors sujet mais réelles.
   Écarte ce qui ne compte plus, en disant pourquoi en quelques mots ; ouvre
   une issue pour chacun des autres, sauf s'il en existe déjà une (cherche
   d'abord), qui dit quoi et pourquoi et renvoie à la PR.

## Ce que tu rends

Dans la réponse qui rend le travail : mergée ou en attente du propriétaire et
pourquoi, combien de passes et ce qu'elles ont corrigé en une ligne, ce qui
est laissé au propriétaire, les issues ouvertes à l'étape 8, et un lien vers
le fichier de revue. Ajoute la même ligne à la description de la PR.

## Garde-fous

- **Les deux relecteurs tournent à chaque passe, sur toute la branche.** Ne
  relire que les dernières corrections rate ce que la première passe a raté.
- **Une trouvaille est bloquante sur du code cité**, jamais sur le résumé
  d'un agent.
- **« Vérifié » ne se dit que de ce que tu as vu échouer puis passer** : pour
  une correction de comportement, retire-la, vois son test passer au rouge,
  remets-la.
- **Les relecteurs ne changent rien** : ils n'ont ni Edit ni Write, mais Bash
  reste ouvert : c'est leur consigne qui interdit toute écriture, `git stash` et `git checkout` compris, puisque
  tu corriges dans la même copie.
