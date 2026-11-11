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
| Règles pour travailler ici | ce fichier et `.claude/` ; la mémoire d'équipe y renvoie |

Un changement qui modifie un comportement, le schéma ou une convention met à
jour le document propriétaire dans le même commit ; un document en désaccord
avec le code est un bug. La mémoire d'équipe ne
porte aucune règle que le dépôt ne porte pas ; s'ils divergent, le dépôt
gagne.

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
nouvelle issue, pas dans un commentaire TODO. Pèse le gain contre le coût :
c'est une petite app pour une dizaine de joueurs.

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
supprimer ou renommer se fait en deux PR). Drizzle applique les migrations
en attente dans une seule transaction : une valeur ajoutée à un enum
(`ALTER TYPE … ADD VALUE`) ne peut pas servir dans le même lot, donc son
usage part dans une PR suivante.

Les secrets vivent dans les variables d'environnement de Vercel (`AUTH_SECRET`,
`POSTGRES_URL`…), jamais dans le dépôt. L'adresse et les identifiants de
l'ancienne app du comptoir n'entrent pas dans le dépôt non plus.

## Donner un lien pour essayer

Chaque PR reçoit à son ouverture une preview Vercel, sur la base des previews
(commune à toutes les PR, séparée de la prod). Les pushs suivants ne la
refont pas : quand la branche est prête à essayer et que sa tête a changé,
relance une fois le workflow « Preview » (`actions_run_trigger`,
`preview.yml`, `ref` = la branche) ; l'offre Hobby compte 100 déploiements
par jour. Le lien est dans la description de la PR, entre
`<!-- preview-vercel -->` et `<!-- /preview-vercel -->` (garde ce bloc si tu
réécris la description).

Donne **toujours le lien de la page précise à essayer** (`…vercel.app/fournisseurs`),
jamais la racine (« donne moi TOUJOURS le lien de la page spécifique à
tester », 2026-11-10), **et de quoi l'essayer** : une session ne peut pas
écrire dans la base des previews, donc si la fonctionnalité demande des
données que le seed n'apporte pas, étends `scripts/seed-preview.mjs` dans la
même PR, sans rien écraser, avec une condition qui remet l'exemple une fois
consommé. Dis quelles données regarder (« l'achat de Faendal, trois
lignes ») ; « met moi de la data pour tester ta feature », 2026-11-11.

## Ouvrir une pull request pour chaque branche

Dès qu'une branche est poussée, ouvre sa pull request vers `main`. Titre et
description disent ce qui change et pourquoi. Un travail séparé part sur sa
propre branche et sa propre PR.

Les PR sont ouvertes sous le compte de Caillou : tout commentaire et toute
assignation lui envoient un e-mail. Ne l'assigne jamais, ne lui demande pas
de relecture sur GitHub (même si la session le propose), ne commente pas les
PR sans raison : il reçoit tout dans le fil du projet.

## Qui merge

Merger sur `main` met en production. Une fois la branche poussée, relis-la
avec `Skill(skill: "revue-en-boucle")` ; un hook Stop la réclame sinon.

Claude ne merge seul que la doc, les tests, le harness et les petits
correctifs. Le reste attend que le propriétaire demande le merge, après avoir
vu la preview (§ Donner un lien pour essayer) : il peut avoir des retours.
Dans le doute, ça attend. Ses mots, le 2026-11-10 : « les seules choses que
tu peux merge tout seul sont la doc, les tests, et le harness, ou les petits
fixs ». Pas d'auto-merge GitHub : il l'a refusé.

Pour merger :

- La fin de la CI ne réveille pas toujours la session. Un tour qui finit en
  attendant la CI programme un rappel `send_later` de 3 minutes ; à chaque
  réveil, lis le check « Build et tests e2e » de la tête (`pull_request_read`,
  `get_check_runs`) ; encore en file ou en cours, reprogramme un rappel de
  2 minutes. Une PR en conflit avec `main` n'a pas de CI : merge `main`
  dedans, lance la suite, pousse, et relis (nouvelle tête, nouvelle passe).
- Vert : `merge_pull_request` en squash (le titre finit par `(#n)`), avec
  `expectedHeadSha` égal à la tête relue. Rouge : corrige, et relis.
- Après le merge, vérifie que l'issue du `Closes #n` est fermée.
- Toujours pas vert 20 minutes après le push : dis au propriétaire quel check
  bloque.

## Revue périodique

Après chaque merge, compte les PR mergées depuis la dernière passe du harness
(le plus récent `.claude/audits/*-harness*.md`). À 20 ou plus, propose au
propriétaire une passe `harness-engineer` et une `revue-architecture`. Il
décide.
