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

Le schéma est dans `lib/db/schema.ts`. Après une modification :

```bash
npm run db:generate -- --name ce-qui-change   # écrit la migration SQL dans drizzle/
npm run db:migrate
```

Sur Vercel, les migrations sont appliquées par le build
(`scripts/vercel-build.sh`), avant la mise en ligne du nouveau code. La prod
utilise la base Supabase de prod ; les previews ont leur propre base Supabase,
connectée au seul environnement Preview avec le préfixe `PREVIEW`
(`PREVIEW_POSTGRES_URL`…), et ne touchent jamais la prod.
Sur une preview, `scripts/seed-preview.mjs` ajoute ensuite le gérant Lomone,
un peu de stock et quelques annonces si la base est neuve (sans jamais rien écraser).

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
  sur `main`, vérification TypeScript, cohérence schéma/migrations, build, puis
  tests e2e Playwright sur un Postgres jetable.
- **Déploiement** : Vercel est relié au repo GitHub. Chaque merge sur `main`
  part en production, chaque pull request reçoit une URL de preview.
  Les tests tournent avant le merge, jamais sur la prod.
- Pour qu'on ne puisse merger que si les tests passent, activer une règle de
  protection sur `main` exigeant le check « Build et tests e2e ».

## Pages

- **Grand livre** : la caisse du jour, des 7 derniers jours et depuis
  l'ouverture (ventes encaissées moins achats payés), et les dernières
  écritures.
- **Achat / Vente** : deux gros boutons, Nouvel achat et Nouvelle vente,
  au-dessus du registre. Chacun ouvre le formulaire sur sa propre page, et
  l'écriture enregistrée ramène au registre. Une écriture porte sur une
  marchandise du stock ou sur un article libre hors stock. Le montant est
  calculé avec le tarif ; le crayon permet de le changer. Le stock bouge :
  +quantité à l'achat, −quantité à la vente, jamais sous zéro. Le registre se
  filtre par opération et par dates (heure de Paris). L'auteur d'une ligne ou
  un gérant peut l'annuler : elle reste barrée, ne compte plus dans la caisse,
  et le stock revient à l'état d'avant.
- **Annonces** : le tableau du comptoir, des parchemins épinglés sur du bois
  (titre, texte, auteur, date). Chacun en accroche avec « Afficher un
  parchemin » et choisit ce qui le fixe : couteau, hache nordique ou morceau
  de viande. L'auteur d'une annonce ou un gérant peut la décrocher. Le Grand
  livre montre les 6 dernières, la page Annonces les montre toutes.
- **Tarifs**, **Inventaire** (entrées et sorties avec motif), et pour les
  gérants **Membres** et **Gérer les tarifs** (créer et modifier les
  marchandises et leurs prix), qu'on ouvre par le bouton du même nom sur la
  page Tarifs.
- Sont paginés : le registre, l'historique du stock, les cartes du stock, les
  marchandises (avec une recherche par nom), les membres et les annonces.

## Rôles

- Au premier lancement, la page de connexion crée le compte du **gérant**.
- Le gérant crée les comptes des **employés** (identifiant + mot de passe
  provisoire) depuis la page Membres, peut réinitialiser un mot de passe ou
  **désactiver** un compte.
- Chacun change son mot de passe avec la clé, en haut à droite.
