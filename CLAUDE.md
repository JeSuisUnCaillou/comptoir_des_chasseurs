# Travailler sur le Comptoir des chasseurs

Une app web de gestion du comptoir des chasseurs de Vendeaume (serveur Skyrim
RP Keizaal) : tarifs, inventaire, ventes et rachats, registre. Une dizaine
d'utilisateurs : le gérant et ses employés. Next.js (App Router, Server
Actions) sur Vercel, Postgres chez Supabase via Drizzle ORM. **Tout doit
rester gratuit** : offre Hobby de Vercel, offre gratuite de Supabase. Une
dépendance, un service ou une option payante se propose au propriétaire, ne
s'ajoute pas.

## À lire d'abord

- [README.md](README.md) : ce que fait l'app, la stack, lancer en local, la
  base, les tests, le déploiement, les rôles. C'est la spécification : un
  comportement qu'il décrit est un comportement à garder.
- `lib/db/schema.ts` : le modèle de données, source des migrations.
- [Issue #1](https://github.com/JeSuisUnCaillou/comptoir_des_chasseurs/issues/1)
  : le plan et l'ordre des chantiers.

## Un fait, une place

Chaque information a un fichier propriétaire ; les autres y renvoient. Quand
quelque chose change, on met à jour son propriétaire, et lui seul.

| Sujet | Propriétaire |
| --- | --- |
| Ce que fait l'app, stack, lancer, tester, déployer, rôles | `README.md` |
| Modèle de données | `lib/db/schema.ts`, migrations dans `drizzle/` |
| Reprise des données de l'ancienne app (`scripts/legacy/`) | `docs/reprise-ancienne-app.md` |
| Tâches, bugs, idées, leur ordre | [issues GitHub](https://github.com/JeSuisUnCaillou/comptoir_des_chasseurs/issues) |
| Règles pour travailler ici | ce fichier ; les instructions du projet Claude et la mémoire d'équipe y renvoient |

Quand le README devient trop long pour un sujet (architecture, glossaire,
décisions), ce sujet part dans un fichier de `docs/` qui en devient le
propriétaire, et ce tableau le dit.

Les instructions du projet Claude et la mémoire d'équipe ne portent aucune
règle que ce fichier ou un skill ne porte pas : le skill `harness-engineer` les
rapatrie à chaque passe. S'ils divergent, le dépôt gagne.

Un changement qui modifie un comportement, le rôle d'un fichier, le schéma ou
une convention met à jour le document propriétaire dans le même commit. Un
document en désaccord avec le code est un bug : corrige celui qui a tort.

## Langue

Le propriétaire, Caillou, écrit en français. Sont en français : l'interface,
le README et les docs, ce fichier et les skills, les messages de commit, les
pull requests, les issues et les réponses. Le code (noms, commentaires) est en
anglais.

## Suivre le travail dans les issues

Avant de commencer un travail, trouve son issue ou ouvres-en une qui dit quoi
et pourquoi. La pull request y renvoie par `Closes #n` dans sa description
pour que le merge la ferme ; une PR qui n'en fait qu'une partie dit `Refs #n`
et laisse l'issue ouverte. Après le merge d'une PR qui dit `Closes #n`,
vérifie que l'issue est bien fermée et, sinon, ferme-la avec un commentaire
qui renvoie à la PR : le propriétaire ne veut pas d'issues réglées qui
traînent (2026-11-11). Ce qu'on découvre en route sans le faire part dans une
nouvelle issue, pas dans un commentaire TODO ; l'étape 8 de la revue en boucle
pèse ces restes à la fin du travail. Quand tu proposes du travail, dis quelles
propositions ont déjà une issue, et pèse le gain contre le coût : c'est une
petite app pour une dizaine de joueurs.

## Tests de bout en bout

L'app est couverte par des tests Playwright dans `e2e/`, lancés contre un
build de production sur un Postgres jetable. **Jamais contre la prod** : le
propriétaire l'a refusé. Ils tournent sur chaque pull request
(`.github/workflows/ci.yml`, check « Build et tests e2e »).

En local, il faut un Postgres et les variables de `.env.example`
(`DATABASE_URL`, `AUTH_SECRET`) ; dans une session cloud, le Postgres du
système suffit, une fois démarré et doté d'un mot de passe et d'une base :

```sh
service postgresql start
su postgres -c "psql -c \"alter user postgres password 'postgres'\""
su postgres -c "psql -c 'create database comptoir_test'"
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/comptoir_test
export AUTH_SECRET=$(openssl rand -base64 32)
npm install
npx playwright install chromium
npm run db:migrate
npm run build
npm run test:e2e
```

**Chaque changement de comportement vient avec un test de bout en bout.** Une
fonctionnalité a un test qui la pilote comme un membre du comptoir le ferait ;
un correctif a un test qui échoue sans lui. Le test est dans le même commit
que le changement, dans le spec de la page concernée, ou un nouveau. Lance
toute la suite avant de pousser, et ne pousse pas avec la suite rouge.

Comment les tests sont écrits :

- On se connecte par le vrai formulaire (`loginAs`, `loginAsGerant` de
  `e2e/helpers.ts`). Le setup global vide les membres et remet le stock à
  zéro, puis crée le gérant de test.
- Les tests tournent en parallèle sur la même base : chaque donnée créée porte
  un nom unique (`uniqueName`). Un employé se crée avec `newEmployeePage`.
- On trouve les éléments comme un utilisateur : par rôle, libellé, texte
  (`getByRole`, `getByLabel`), un `data-testid` en dernier recours. On
  vérifie ce qui est à l'écran, pas l'état interne.
- On attend sur des assertions (`await expect(...)`), jamais sur
  `waitForTimeout`.

Vérifier les types ne suffit jamais : un changement n'est fini que quand il a
été vu marcher dans l'app, par la suite ou un test piloté de la même façon.

## Base de données

Le schéma change dans `lib/db/schema.ts`, puis `npm run db:generate -- --name
ce-qui-change` écrit la migration dans `drizzle/`, commitée avec lui. La CI
échoue si les migrations ne correspondent pas au schéma.

Sur Vercel, le build applique les migrations (`scripts/vercel-build.sh`) avant
`next build`, en production comme sur les previews. Les previews ont leur
propre base Supabase (variables préfixées `PREVIEW_`, préférées par
`lib/db/url.mjs`) ; la prod n'est connectée qu'à Production. Pendant le build
de prod, l'ancien code tourne encore sur la base migrée : **une migration
reste compatible avec le code en prod** (ajouter des tables ou des colonnes ;
supprimer ou renommer se fait en deux PR).

Les secrets vivent dans les variables d'environnement de Vercel (`AUTH_SECRET`,
`POSTGRES_URL`…), jamais dans le dépôt. L'adresse et les identifiants de
l'ancienne app du comptoir n'entrent pas dans le dépôt non plus.

## Donner un lien pour essayer

Chaque pull request reçoit une preview Vercel, avec sa propre base, construite
une seule fois à son ouverture (README § Intégration et déploiement continus).
Les pushs suivants ne la refont pas : quand la branche est prête à essayer et
que sa tête a changé depuis, relance le workflow « Preview » sur la branche
(`actions_run_trigger`, `preview.yml`, `ref` = la branche), une fois, pas à
chaque push : l'offre Hobby compte 100 déploiements par jour. Donne au
propriétaire le lien de la preview que ce workflow publie en commentaire sur la
PR, **toujours vers la page précise à essayer** (chemin complet,
par exemple `…vercel.app/fournisseurs`), jamais la seule racine de la preview.
Le propriétaire l'a demandé le 2026-11-10 : « donne moi TOUJOURS le lien de la
page spécifique à tester ». Sur une base de preview vide, la première visite
crée le compte du gérant.

## Ouvrir une pull request pour chaque branche

Dès qu'une branche est poussée, ouvre sa pull request vers `main` sans
attendre qu'on le demande. Titre et description disent ce qui change et
pourquoi. Un travail séparé part sur sa propre branche et sa propre PR, même
si une autre attend.

N'assigne jamais Caillou (`JeSuisUnCaillou`) à une PR ou une issue et ne lui
demande pas de relecture sur GitHub, même si la session le propose : ça lui
envoie des e-mails. Il reçoit le lien de la preview dans la discussion.

## Qui merge

Merger sur `main` met en production. Une fois le travail poussé, relis-le avec
`Skill(skill: "revue-en-boucle")` avant de le rendre ; un hook Stop la lance
sinon. Claude ne merge seul que la doc, les tests, le harness et les petits
correctifs ; le reste attend l'accord du propriétaire, donné après qu'il a vu
la preview. L'étape 7 du skill dit comment.

Merge en squash, pour que le titre finisse par le numéro de la PR, `… (#n)`.

## Revue périodique

Toutes les 20 pull requests mergées dans `main`, le harness et tout le code
passent en revue. Une session lancée pour ça suit cette section :

1. Si une issue étiquetée `periodic-review` est ouverte, une passe précédente
   a été coupée : reprends-la à l'étape atteinte. Sinon compte les PR mergées
   dans `main` depuis la fermeture de la plus récente, ou depuis la PR qui a
   ajouté `.claude/` s'il n'y en a pas. Moins de 20 : arrête et dis-le.
2. Ouvre une issue `periodic-review`, « Revue périodique après #n ». C'est
   aussi l'issue de la passe du harness : elle n'en ouvre pas d'autre, et sa
   PR dit `Refs #n`, pour que son merge laisse cette issue à l'étape 4.
3. Lance `Skill(skill: "harness-engineer")` et la revue en boucle sur sa
   branche, puis `Skill(skill: "revue-architecture")`.
4. Ferme l'issue une fois que la revue d'architecture y a posté son rapport.
