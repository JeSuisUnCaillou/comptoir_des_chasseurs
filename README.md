# Comptoir des chasseurs

App de gestion du stock, des achats et des ventes du comptoir des chasseurs
de Vendeaume, pour le serveur Skyrim RP Keizaal.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- Hébergement : [Vercel](https://vercel.com) (offre Hobby, gratuite)
- Base de données (à venir) : [Supabase](https://supabase.com) (offre gratuite)
- Tests e2e : [Playwright](https://playwright.dev)

## Développer en local

```bash
npm install
npm run dev          # http://localhost:3000
```

## Tests

```bash
npx playwright install chromium   # une seule fois
npm run build
npm run test:e2e                  # lance l'app buildée et la teste
BASE_URL=https://exemple.vercel.app npm run test:e2e   # teste un site déployé
```

## Intégration et déploiement continus

- **CI** (`.github/workflows/ci.yml`) : sur chaque pull request et chaque push
  sur `main`, vérification TypeScript, build, puis tests e2e Playwright.
- **Déploiement** : Vercel est relié au repo GitHub. Chaque merge sur `main`
  part en production, chaque pull request reçoit une URL de preview.
  Les tests tournent avant le merge, jamais sur la prod.
- Pour qu'on ne puisse merger que si les tests passent, activer une règle de
  protection sur `main` exigeant le check « Build et tests e2e ».
