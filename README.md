# Comptoir des chasseurs

App de gestion du stock, des achats et des ventes du comptoir des chasseurs
de Vendeaume, pour un serveur de jeu de rôle.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Server Actions)
- Hébergement : [Vercel](https://vercel.com) (offre Hobby, gratuite)
- Base de données : Postgres chez [Supabase](https://supabase.com) (offre gratuite),
  via [Drizzle ORM](https://orm.drizzle.team)
- Connexion : identifiant + mot de passe (scrypt), ou Discord (OAuth2, voir
  [Connexion avec Discord](#connexion-avec-discord)), session signée dans un cookie
- Lecture des captures du jeu : [tesseract.js](https://github.com/naptha/tesseract.js)
  (OCR dans le navigateur, gratuit). `scripts/copy-ocr-assets.mjs` copie son
  worker, son cœur WebAssembly et le français dans `public/ocr/` (non commité)
  avant `next dev` et chaque build : l'app les sert elle-même, sans CDN.
- Tests e2e : [Playwright](https://playwright.dev)

Où vit le code (pages, Server Actions, services de `lib/`, domaine pur) :
[docs/architecture.md](docs/architecture.md). `npm run lint` vérifie les types
et le sens des imports.

## Développer en local

Il faut Node 22.18 ou plus et un Postgres local.

```bash
npm install
cp .env.example .env.local      # puis remplir les valeurs
npm run db:migrate              # crée les tables
npm run dev                     # http://localhost:3000
```

Au premier lancement (aucun membre en base), la page de connexion propose de
créer le compte du gérant.

## Base de données

Le schéma est dans `lib/db/schema.ts`. Une seule base héberge plusieurs
**boutiques** (table `shops`) : les marchandises, l'historique du stock, le
registre, les annonces, les contacts et les réglages appartiennent chacun à
une boutique (`shop_id`), et chaque page ou action ne lit et n'écrit que ceux de
la boutique visitée (`currentShop`, `lib/shops.ts`).

`lib/db/url.mjs` choisit la base : `DATABASE_URL` si elle est là, sinon celle
que Vercel fournit selon `VERCEL_ENV` (la base des previews sur une preview).
Les migrations et le seed prennent `DATABASE_MIGRATION_URL` avant
`DATABASE_URL` (voir `.env.example`). La migration des boutiques
a rangé tout l'existant dans la première, « Le Comptoir Des Chasseurs »
([#113](https://github.com/JeSuisUnCaillou/comptoir_des_chasseurs/issues/113)).

Après une modification du schéma :

```bash
npm run db:generate -- --name ce-qui-change   # écrit la migration SQL dans drizzle/
npm run db:migrate
```

Sur Vercel, les migrations sont appliquées par le build
(`scripts/vercel-build.sh`), avant la mise en ligne du nouveau code. La prod
utilise la base Supabase de prod ; les previews ont leur propre base Supabase,
commune à toutes les pull requests,
connectée au seul environnement Preview avec le préfixe `PREVIEW`
(`PREVIEW_POSTGRES_URL`…), et ne touchent jamais la prod.
Sur une preview, `scripts/seed-preview.mjs` ajoute ensuite le gérant Lomone, super admin si personne ne l'est, une seconde gérante, Aela (même mot de passe, jamais super admin),
un peu de stock, quelques annonces et les fournisseurs de l'ancienne app si la base est neuve, un client, Roy, s'il manque, une seconde boutique, « La Taverne du Port » (`/taverne-du-port`, Aela gérante, quelques marchandises et une annonce) si elle manque, puis des achats et des ventes de plusieurs lignes, dont trois en attente de la caisse, chaque fois qu'aucun de ces exemples n'attend plus la caisse (sans jamais rien écraser).
Quand la base des previews porte une copie de la prod (ci-dessous), le seed
n'ajoute que Lomone et Aela, jamais d'exemples par-dessus les vraies données.

### Copier la prod dans la base des previews

Pour essayer une fonctionnalité sur les vraies données du comptoir,
`npm run preview:copie-prod` remplace **tout** le contenu de la base des
previews par une copie de la prod. Il se lance à la main depuis un poste en
Europe (le cloud de Claude ne joint pas Supabase), avec Node 22, le dépôt
cloné et `npm install`. Les deux URL Postgres (celles de Supabase, pooler de
session, port 5432) sont demandées au lancement sans s'afficher, jamais lues
dans l'environnement ; sous Windows dans Git Bash, lancer
`winpty node scripts/preview/copy-prod.mjs`.

- La prod n'est que lue, dans une transaction en lecture seule ; la preview
  s'écrit en une transaction : en cas d'erreur, elle ne bouge pas.
- Refusé si la cible n'a pas le gérant Lomone des previews ou si la source
  l'a (adresses inversées), si la preview n'a pas toutes les migrations de la
  prod (construire d'abord une preview à jour de `main`), ou si une adresse
  de pooler Supabase (`aws-0-<région>.pooler.supabase.com`, celle à donner)
  est hors d'Europe.
- La preview garde son schéma et ses migrations ; Lomone et Aela y sont remis
  (Lomone n'est pas super admin : celui de la prod le reste). Les comptes de
  la prod gardent leur mot de passe.
- `--essai` montre ce qui serait copié sans rien écrire ; on tape
  « écraser la preview » pour confirmer (`--oui` saute la question,
  `--source=<url>` et `--cible=<url>` évitent les questions, mais restent dans
  l'historique du terminal).
- La copie reste jusqu'à la suivante ; toutes les PR la voient, puisque la
  base des previews est commune. Une table `copie_de_la_prod` la signale au
  seed ; la supprimer lui fait de nouveau ajouter ses exemples.

`npm run test:copie-prod` (lancé par la CI) joue le script entre deux bases
jetables.

## Reprendre les données de l'ancienne app

Deux scripts, `scripts/legacy/`, copient les données de l'ancienne app du
comptoir dans une base de la nouvelle : voir
[docs/reprise-ancienne-app.md](docs/reprise-ancienne-app.md).

## Tests

```bash
npx playwright install chromium   # une seule fois
npm run build
npm run test:e2e                  # vide la base de test, lance l'app et la teste
```

`npm run test:parser` (lancé par la CI, sans base ni navigateur) teste
l'analyseur de coffre seul (`lib/game-count.ts`) sur des lignes déjà lues :
celles des huit captures de l'armoire de Lomone (`tests/armoire-8-captures.json`),
et les mêmes abîmées comme l'OCR d'un autre navigateur peut les lire ; puis
les règles de la relecture (marchandise reconnue ou supposée, écarts,
points à vérifier, avertissements sur les captures). Un défaut de lecture
remonté devient un cas de plus dans `tests/game-count.test.mjs`.

Les tests vident la base : ils refusent de tourner si le nom de la base
(dans `DATABASE_URL`) ne contient pas `test`. Playwright lance aussi un faux
Discord (`e2e/fake-discord.mjs`, port 3999) et le donne à l'app.

## Intégration et déploiement continus

- **CI** (`.github/workflows/ci.yml`, qui fait foi pour la liste des
  étapes) : sur chaque pull request et chaque push sur `main`, `npm run lint`
  (types et sens des imports), cohérence schéma/migrations, tests sans
  navigateur (analyseur de coffre, reprise de l'ancienne app, copie de la
  prod), build, puis tests e2e Playwright sur un Postgres jetable.
- **Déploiement** : Vercel est relié au repo GitHub. Chaque merge sur `main`
  part en production. Les autres branches ne déploient rien d'elles-mêmes
  (`git.deploymentEnabled` dans `vercel.json`) : l'offre Hobby limite à 100
  déploiements par jour, et un build ignoré compte quand même.
- **Preview** (`.github/workflows/preview.yml`) : à l'ouverture (ou la
  réouverture) d'une pull request, une preview est construite sur Vercel avec
  les variables de l'environnement Preview, et son lien est écrit à la fin de
  la description de la PR (pas en commentaire : chaque commentaire envoie un
  e-mail à l'auteur de la PR). Les pushs suivants ne la mettent pas à jour :
  pour la refaire, lancer le workflow « Preview » sur la branche (onglet
  Actions, « Run workflow »), et le lien est remplacé dans la description. Il faut trois secrets
  dans le dépôt (Settings → Secrets and variables → Actions) :
  `VERCEL_TOKEN` (un jeton créé sur vercel.com/account/tokens),
  `VERCEL_ORG_ID` et `VERCEL_PROJECT_ID` (dans les réglages du compte et du
  projet Vercel). Sans eux, le workflow passe sans rien déployer.
- Les tests tournent avant le merge, jamais sur la prod.
- **Région** : les fonctions Vercel tournent à Francfort (`fra1`, `regions`
  dans `vercel.json`), la région Vercel la plus proche de la base Supabase de
  prod (Zurich, `eu-central-2`). Chaque page fait plusieurs requêtes à la base
  l'une après l'autre : un serveur loin de la base paie un aller-retour
  transatlantique à chacune. Si la base change de région, la région de
  `vercel.json` la suit.
- **Adresse fixe des previews** : le workflow « Preview » fait aussi pointer
  `https://comptoirdeschasseurs-preview.vercel.app` sur la preview qu'il vient
  de construire (la dernière construite, toutes PR confondues). Discord
  n'accepte que des adresses de retour déclarées d'avance : c'est celle-là
  qu'on déclare pour les previews.
- Pour qu'on ne puisse merger que si les tests passent, activer une règle de
  protection sur `main` exigeant le check « Build et tests e2e ».

## Connexion avec Discord

L'app parle directement à Discord (OAuth2, scope `identify`, sans dépendance
ni Supabase Auth) et garde ses propres sessions. Pour l'activer :

1. Créer une application sur
   [discord.com/developers/applications](https://discord.com/developers/applications)
   (gratuit).
2. Dans OAuth2 → Redirects, déclarer
   l'adresse de prod, `https://codexomancien.vercel.app/auth/discord/callback`
   (et les anciennes, `https://registre-de-lomone.vercel.app/auth/discord/callback`
   et `https://comptoirdeschasseurs.vercel.app/auth/discord/callback`),
   et celle des previews, `https://comptoirdeschasseurs-preview.vercel.app/auth/discord/callback`
   (et `http://localhost:3000/auth/discord/callback` pour essayer en local).
3. Mettre son Client ID et son Client Secret dans les variables
   `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` de Vercel (Production et
   Preview) ou de `.env.local`.

Sans ces deux variables, le bouton « Se connecter avec Discord » n'apparaît
pas. Ce que fait la connexion Discord : [docs/comportement.md](docs/comportement.md#connexion).

## Ce que fait l'app

Pages, règles métier et rôles : [docs/comportement.md](docs/comportement.md).
