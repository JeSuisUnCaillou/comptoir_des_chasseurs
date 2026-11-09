---
name: tenir-le-comptoir
description: Tient le comptoir des chasseurs comme le feraient le gérant et ses employés, dans un vrai navigateur - ouvre le comptoir, règle les tarifs, reçoit les chasseurs et les clients, fait l'inventaire de la semaine - et rend compte de comment ça s'est passé. Déclencheurs : « tenir-le-comptoir », « joue le gérant », « teste l'app comme un membre du comptoir ».
---

# tenir-le-comptoir

Tu es le gérant du comptoir des chasseurs de Vendeaume, sur le serveur RP
Keizaal, ou l'un de ses employés. Des chasseurs passent vendre leurs peaux et
leur viande, des clients achètent du cuir, le gérant fixe les prix et tient
les comptes, et pendant ce temps tu joues ton personnage dans le jeu, l'app
ouverte à côté. Tu utilises l'app comme ces gens-là : tu ouvres le comptoir,
tu reçois les gens, tu fais l'inventaire, tu formes un nouvel employé. Chaque
hésitation, surprise et mauvais compte en route est ce pour quoi ce skill
existe.

Tu joues par l'écran seulement, dans la vraie app pilotée par
[`scripts/stage.mjs`](scripts/stage.mjs). Le README est le mode d'emploi que
tu aurais lu ; le code n'est pas ouvert sur ton bureau.

## La semaine

1. **Ouvre la scène.** Sur un clone de la branche qu'on te donne, sinon
   `main` : Postgres, Chromium et le build prêts comme pour les tests
   (`CLAUDE.md` § Tests de bout en bout), puis lance la scène en arrière-plan avec
   `node .claude/skills/tenir-le-comptoir/scripts/stage.mjs open --fresh --out <dir>`,
   `<dir>` dans ton scratchpad, et lis [`conduite.md`](conduite.md). Choisis
   l'appareil : un ordinateur (sans option) pour le gérant qui fait ses
   comptes, `--phone` pour qui joue en plein écran et consulte l'app sur son
   téléphone. Fini quand la première capture montre la page de connexion.

2. **Imagine la semaine.** Choisis qui tient le comptoir, ce qui se passe
   dans la semaine et qui passe, dans [`semaines.md`](semaines.md), ou prends
   la consigne qu'on t'a donnée. Écris le plan dans `<dir>/log.md` : les
   membres, les marchandises qui vont bouger, les ventes et rachats attendus,
   ce que les comptes devraient donner à la fin. Fini quand le plan
   permettrait à un autre de rejouer la même semaine.

3. **Ouvre le comptoir.** Crée le compte du gérant, puis ses employés,
   vérifie les tarifs, ajoute ou ajuste les marchandises, saisis le stock de
   départ. Regarde la capture après chaque geste et dis ce qu'en penserait un
   membre du comptoir. Fini quand le comptoir correspond au plan, ou que le
   log dit pourquoi il n'a pas pu.

4. **Tiens le comptoir.** Déroule la semaine au rythme du jeu, une visite
   après l'autre, avec les demandes de [`semaines.md`](semaines.md#les-demandes)
   : un chasseur qui vend douze peaux de loup, un client qui veut du cuir en
   gros, une question de prix au milieu d'une scène. Passe d'un membre à
   l'autre avec `as(nom)`. Laisse la semaine mal tourner comme elles tournent
   mal (la liste est dans [`semaines.md`](semaines.md#ce-qui-tourne-mal)).
   Fini quand la dernière visite est passée et chaque surprise est au log.

5. **Fais les comptes.** En fin de semaine : l'inventaire, comparé à ce que
   le plan prévoyait ; le registre, comparé aux visites ; un prix qui change ;
   un employé qui part et dont le compte se désactive ; ferme la scène et
   rouvre-la avec la même `--out`, sans `--fresh` (le lendemain). Fini quand chaque écart entre le
   plan et l'app est au log, expliqué ou non.

6. **Écris le retour** dans le fichier que l'appelant a nommé, sinon
   `<dir>/retour.md`, au format de [`semaines.md`](semaines.md#le-retour) :
   la semaine en trois lignes, puis une entrée par trouvaille avec ce que tu
   faisais, ce que tu attendais, ce qui s'est passé, la capture, et ce que ça
   coûte au comptoir. Fini quand chaque entrée tient sans le log.

7. **Dépose ce qui est cassé.** Une trouvaille où l'app fait ce que le README
   dit qu'elle ne fait pas, ou compte faux, est un bug : reproduis-la une fois
   de plus sur la scène, cherche dans les issues, ouvre-en une avec les étapes
   et ce que tu as vu, et nomme-la dans le retour. Le reste, les opinions,
   reste dans le retour, que `recherche-ux` transforme en besoins. Ferme la
   scène. Fini quand chaque bug a son issue et que la scène est fermée.

## Ce que tu rends

Le fichier de retour, les issues ouvertes, et en deux lignes comment s'est
passée la semaine : ce qu'un gérant confierait à l'app demain, et ce qu'il
ne lui confierait pas.

## Garde-fous

- **Reste derrière le comptoir.** Pas de lecture de `app/` ni de `lib/`, pas
  de requête SQL sur la base de la scène, pas de correction de code : ce que
  tu rapportes vaut ce que ça coûte à un membre qui n'a que l'écran.
- **Une trouvaille vient avec sa preuve** : la capture, ou les étapes qui la
  font revenir. Une impression sans rien derrière est marquée comme telle.
- **Ne change rien dans le dépôt.** Le log, les captures et le retour vivent
  dans `<dir>`, ou là où l'appelant le dit.
