# Comptoir des chasseurs

App de gestion du stock, des achats et des ventes du comptoir des chasseurs
de Vendeaume, pour le serveur Skyrim RP Keizaal.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Server Actions)
- Hébergement : [Vercel](https://vercel.com) (offre Hobby, gratuite)
- Base de données : Postgres chez [Supabase](https://supabase.com) (offre gratuite),
  via [Drizzle ORM](https://orm.drizzle.team)
- Connexion : identifiant + mot de passe (scrypt), session signée dans un cookie
- Tests e2e : [Playwright](https://playwright.dev)

Où vit le code (pages, Server Actions, services de `lib/`, domaine pur) :
[docs/architecture.md](docs/architecture.md). `npm run lint` vérifie les types
et le sens des imports.

## Développer en local

Il faut Node 22 et un Postgres local.

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
la boutique visitée (`currentShop`, `lib/shops.ts`). La migration des boutiques
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

Les tests vident la base : ils refusent de tourner si le nom de la base
(dans `DATABASE_URL`) ne contient pas `test`.

## Intégration et déploiement continus

- **CI** (`.github/workflows/ci.yml`) : sur chaque pull request et chaque push
  sur `main`, vérification TypeScript, cohérence schéma/migrations, tests des
  scripts de reprise de l'ancienne app, build, puis tests e2e Playwright sur un
  Postgres jetable.
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
- Pour qu'on ne puisse merger que si les tests passent, activer une règle de
  protection sur `main` exigeant le check « Build et tests e2e ».

## Ce que fait l'app

Pages, règles métier et rôles : [docs/comportement.md](docs/comportement.md).
