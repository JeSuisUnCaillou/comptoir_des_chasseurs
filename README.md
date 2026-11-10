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

## Reprendre les données de l'ancienne app

Deux scripts, lancés à la main depuis un poste qui joint l'ancienne app (le
cloud de Claude ne la joint pas). Il faut Node 22 et le dépôt cloné, avec
`npm install`. L'adresse, les identifiants et l'URL de la base sont demandés
au lancement, jamais lus dans l'environnement ni écrits dans le dépôt.

```bash
npm run legacy:export
npm run legacy:import -- legacy-export/ancienne-app-….json --cible=preview --essai
npm run legacy:import -- legacy-export/ancienne-app-….json --cible=preview
```

Sous Windows dans Git Bash, lancer `winpty node scripts/legacy/export.mjs`
(et de même pour l'import) : sans `winpty`, le mot de passe s'affiche à la
frappe.

1. `legacy:export` (ou `node scripts/legacy/export.mjs <adresse> <identifiant>
   [<mot de passe>]`, qui demande ce qui manque ; un mot de passe passé ainsi
   reste dans l'historique du terminal) se connecte à l'ancienne app (certificat auto-signé
   accepté pour elle seule) et écrit tout ce que son API renvoie dans
   `legacy-export/` (ignoré par git) : stock, mouvements, tarifs des peaux,
   du cuir et des viandes, registre complet, trésorerie, fournisseurs,
   annonces. Prendre un compte de gérant, sinon des routes manquent.
2. `legacy:import` lit ce fichier et **remplace** dans la base cible les
   marchandises, l'historique du stock, le registre et les annonces, et met
   à jour le prix du cuir chez le forgeron. Les membres existants ne changent
   pas : chaque ligne est rattachée au membre du même identifiant ou du même
   nom. Un auteur de l'ancienne app sans compte en reçoit un à son nom, en
   employé et sans mot de passe (identifiant tiré du nom, sans accents ni
   espaces) ; le gérant lui en donne un depuis Membres.
   Les ajustements de trésorerie deviennent des mouvements de caisse
   « Ajustement de trésorerie » du registre. Les fournisseurs restent dans le
   fichier tant que l'app n'a pas de place pour eux.
   - `--cible=preview` ou `--cible=prod` est obligatoire ; on tape
     « écraser la preview » ou « écraser la prod » pour confirmer
     (`--cible=local`, pour le test, n'accepte qu'une base sur la machine).
   - `--base=<url>` donne l'URL de la base et `--oui` confirme sans la
     question, pour tout lancer en une ligne (l'URL reste alors dans
     l'historique du terminal).
   - `--essai` montre ce qui serait remplacé, la caisse obtenue et les
     avertissements, sans rien écrire.
   - Avant d'écrire, l'existant est sauvegardé dans `legacy-export/`, et tout
     s'écrit en une transaction : en cas d'erreur, la base ne bouge pas.

`npm run test:legacy` (lancé par la CI) joue les deux scripts contre une
fausse ancienne app et une base `comptoir_import_test`.

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
  part en production, chaque pull request reçoit une URL de preview.
  Les tests tournent avant le merge, jamais sur la prod.
- Pour qu'on ne puisse merger que si les tests passent, activer une règle de
  protection sur `main` exigeant le check « Build et tests e2e ».

## Pages

- **Grand livre** : la caisse du jour, des 7 derniers jours et depuis
  l'ouverture (ventes encaissées moins achats payés, plus ou moins les
  mouvements de caisse), et les dernières écritures.
- **Achat / Vente** : trois gros boutons, Nouvel achat, Nouvelle vente et
  Mouvement de caisse, au-dessus du registre. Chacun ouvre le formulaire sur sa propre page, et
  l'écriture enregistrée ramène au registre. Une écriture porte sur une
  marchandise du stock ou sur un article libre hors stock. Le montant est
  calculé avec le tarif ; le crayon permet de le changer. Le stock bouge :
  +quantité à l'achat, −quantité à la vente, jamais sous zéro. Le registre se
  filtre par opération et par dates (heure de Paris). L'auteur d'une ligne ou
  un gérant peut l'annuler : elle reste barrée, ne compte plus dans la caisse,
  et le stock revient à l'état d'avant. Un **mouvement de caisse** fait entrer
  ou sortir des septims sans marchandise (salaires, apport du gérant…) : sens,
  montant, motif, et l'aperçu de la caisse après lui. Tout membre peut en
  inscrire ; il a le badge *Caisse* dans le registre et son propre filtre.
- **Annonces** : le tableau du comptoir, des parchemins épinglés sur du bois
  (titre, texte, auteur, date). Chacun en accroche avec « Afficher un
  parchemin » et choisit ce qui le fixe : couteau, hache nordique ou morceau
  de viande. L'auteur d'une annonce ou un gérant peut la décrocher. Le Grand
  livre montre tout le tableau d'un coup, sans pagination (choix du
  propriétaire) ; la page Annonces le montre 12 parchemins par page.
- **Tarifs**, **Inventaire** (entrées et sorties avec motif), et pour les
  gérants **Membres** et **Gérer les tarifs** (créer et modifier les
  marchandises et leurs prix), qu'on ouvre par le bouton du même nom sur la
  page Tarifs.
- Sont paginés : le registre, l'historique du stock, les cartes du stock, les
  marchandises (avec une recherche par nom), les membres et les annonces.
- Les marchandises (cartes du stock, Gérer les tarifs, sections des Tarifs,
  choix d'Achat/Vente) et les membres sont rangés par nom, de A à Z, sans
  tenir compte des majuscules ni des accents ; les marchandises archivées
  viennent en dernier. Le registre, l'historique du stock et les annonces
  restent du plus récent au plus ancien.

## Rôles

- Au premier lancement, la page de connexion crée le compte du **gérant**.
- Le gérant crée les comptes des **employés** (identifiant + mot de passe
  provisoire) depuis la page Membres, peut réinitialiser un mot de passe ou
  **désactiver** un compte.
- Chacun change son mot de passe avec la clé, en haut à droite.
