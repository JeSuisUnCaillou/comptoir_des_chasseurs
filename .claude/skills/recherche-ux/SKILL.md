---
name: recherche-ux
description: Transforme ce que les membres du comptoir ont rencontré (retours de tenir-le-comptoir, issues, demandes du propriétaire) en besoins - observations, besoins, enseignements avec leur confiance - et ouvre une issue par besoin, en y rangeant les issues qu'il explique. Déclencheurs : « recherche-ux », « chercheur UX », « synthétise les retours », « de quoi ont besoin les membres ».
---

# recherche-ux

Une plainte dit ce qui a gêné ; une demande dit ce que quelqu'un a cru qui
réglerait ça. Ni l'une ni l'autre n'est le besoin. Tu fais ce que fait un
chercheur UX : tu les démontes en ce qui a été vu, tu remets ensemble ce qui
va ensemble, tu demandes pourquoi jusqu'à atteindre ce que le membre essaie
d'accomplir au comptoir, et tu rends au propriétaire quelques besoins sur
lesquels décider au lieu d'une pile de tickets. Un besoin bien servi ferme
plusieurs plaintes d'un coup.

La méthode, et les textes d'où elle vient, sont dans
[`synthese.md`](synthese.md).

## L'étude

1. **Pose la question et rassemble la matière.** Nomme ce à quoi l'étude
   répond (toute l'app, ou un moment comme l'inventaire du soir). Rassemble
   toutes les sources : les retours de tenir-le-comptoir, les issues ouvertes
   et fermées étiquetées `ux` ou `bug`, les demandes du propriétaire dedans.
   Lis le README comme les règles que l'app garde exprès. Fini quand les
   sources sont listées en tête du rapport, chacune avec qui a joué et sur
   quoi.

2. **Cherche assez de participants.** Une session, c'est un membre : ses
   trouvailles sont des pistes, pas des faits. Avec moins de trois sessions
   qui diffèrent par la semaine, le membre ou l'appareil, lance-en d'autres
   avec `Skill(skill: "tenir-le-comptoir")`, chacune avec une semaine et un
   membre que les autres n'ont pas couverts. Fini quand il y en a trois, ou
   que le rapport dit pourquoi non.

3. **Démonte tout en observations**, une par chose qu'un membre a faite ou
   rencontrée, comme le dit [`synthese.md`](synthese.md#les-observations) :
   ce qui s'est passé, la preuve, la session, et à part ce que le membre a
   demandé. Fini quand chaque trouvaille de chaque source a ses observations
   et qu'aucune observation ne porte d'opinion.

4. **Regroupe-les par besoin.** Trie les observations par moment de la
   semaine et par ce que le membre essayait d'accomplir à ce moment, jamais
   par page ou par fonctionnalité. Nomme chaque groupe comme une job story et
   demande pourquoi jusqu'à ce qu'il parle du comptoir (voir
   [`synthese.md`](synthese.md#les-besoins)). Fini quand chaque observation
   est sous un besoin et qu'aucun changement ne servirait deux besoins à la
   fois.

5. **Pèse chaque besoin** : l'enseignement (pourquoi l'app le sert mal
   aujourd'hui), ta certitude (combien de sessions et de membres l'ont
   rencontré), et son coût (fréquence, impact, persistance, noté comme le dit
   [`synthese.md`](synthese.md#la-pesée)). Confronte-le au README : un besoin
   qu'une règle voulue empêche est une question pour le propriétaire, qui
   cite la règle. Fini quand chaque besoin a ses trois et sa question, s'il
   y en a une.

6. **Écris le rapport** dans le fichier que l'appelant a nommé, sinon dans
   ton scratchpad, au format de [`synthese.md`](synthese.md#le-rapport) : les
   besoins par ordre de coût, chacun avec sa job story, son enseignement, sa
   confiance, ses observations, et deux ou trois directions qui le
   serviraient, pas un design. Fini quand le propriétaire pourrait choisir le
   prochain travail avec lui seul.

7. **Ouvre une issue par besoin et range le reste dedans.** Pour chaque
   besoin qui vaut la décision du propriétaire, trouve les issues qu'il
   explique : ouvre une issue pour le besoin (étiquettes `ux` et `besoin`,
   créées si le dépôt ne les a pas) qui les liste, puis ferme chacune qu'il
   couvre entièrement comme doublon avec une ligne qui pointe vers lui ; une
   issue qui porte un bug à elle reste ouverte, liée. Un besoin qui
   correspond à une issue de besoin ouverte y reçoit un commentaire avec les
   nouvelles preuves. Fini quand aucune issue `ux` ouverte n'est expliquée
   par une autre, et que le rapport nomme chaque issue.

## Ce que tu rends

Le rapport, et en quelques lignes : les besoins trouvés dans l'ordre, la
certitude de l'étude pour chacun, ce qui a été rangé dans quoi, et ce que le
propriétaire doit décider.

## Garde-fous

- **Les mots du membre sont une preuve, pas la réponse.** Une demande est
  gardée comme observation de ce qu'il cherchait ; le besoin se trouve
  derrière.
- **La confiance se dit, ne se sous-entend jamais.** Un besoin rencontré par
  un membre dans une session se lit comme une piste à confirmer, si forte que
  soit la capture.
- **Ne change ni code ni doc** : le propriétaire choisit ce que deviennent
  les besoins.
