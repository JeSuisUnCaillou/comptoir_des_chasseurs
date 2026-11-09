# Comptoir des chasseurs

App de gestion du stock, des achats et des ventes du comptoir des chasseurs
de Vendeaume, pour le serveur Skyrim RP Keizaal.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Server Actions)
- Hébergement : [Vercel](https://vercel.com) (offre Hobby, gratuite)
- Base de données : Postgres chez [Supabase](https://supabase.com) (offre gratuite),
  via [Drizzle ORM](https://orm.drizzle.team)
- Connexion : Discord (OAuth2), session signée dans un cookie
- Tests e2e : [Playwright](https://playwright.dev)

## Développer en local

Il faut Node 22 et un Postgres local.

```bash
npm install
cp .env.example .env.local      # puis remplir les valeurs
npm run db:migrate              # crée les tables
npm run dev                     # http://localhost:3000
```

Sans application Discord en local, mettre `AUTH_TEST_LOGIN=1` dans `.env.local`
et se connecter via `/api/auth/test-login?name=Lomone`. Cette route n'existe
jamais sur Vercel.

## Base de données

Le schéma est dans `lib/db/schema.ts`. Après une modification :

```bash
npm run db:generate -- --name ce-qui-change   # écrit la migration SQL dans drizzle/
npm run db:migrate
```

En production, les migrations sont appliquées par le build Vercel
(`scripts/vercel-build.sh`), avant la mise en ligne du nouveau code.

## Tests

```bash
npx playwright install chromium   # une seule fois
npm run build
npm run test:e2e                  # vide la base de test, lance l'app et la teste
```

## Intégration et déploiement continus

- **CI** (`.github/workflows/ci.yml`) : sur chaque pull request et chaque push
  sur `main`, vérification TypeScript, cohérence schéma/migrations, build, puis
  tests e2e Playwright sur un Postgres jetable.
- **Déploiement** : Vercel est relié au repo GitHub. Chaque merge sur `main`
  part en production, chaque pull request reçoit une URL de preview.
  Les tests tournent avant le merge, jamais sur la prod.
- Pour qu'on ne puisse merger que si les tests passent, activer une règle de
  protection sur `main` exigeant le check « Build et tests e2e ».

## Rôles

- Le premier membre connecté devient **gérant**.
- Les suivants arrivent **en attente**, jusqu'à ce qu'un gérant les passe
  **employé** (ou gérant) depuis la page Membres.
