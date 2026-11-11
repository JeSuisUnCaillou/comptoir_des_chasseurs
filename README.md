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
commune à toutes les pull requests,
connectée au seul environnement Preview avec le préfixe `PREVIEW`
(`PREVIEW_POSTGRES_URL`…), et ne touchent jamais la prod.
Sur une preview, `scripts/seed-preview.mjs` ajoute ensuite le gérant Lomone, une seconde gérante, Aela (même mot de passe, jamais super admin),
un peu de stock, quelques annonces et les fournisseurs de l'ancienne app si la base est neuve, puis des achats et des ventes de plusieurs lignes, dont trois en attente de la caisse, chaque fois qu'aucun de ces exemples n'attend plus la caisse (sans jamais rien écraser).

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

## Pages

- **Grand livre** : quatre tuiles sur tout le registre, comme dans l'ancienne
  app : la trésorerie actuelle (ventes encaissées moins achats payés, plus ou
  moins les mouvements de caisse, dont elle donne le total), le total des
  ventes, le total des rachats et le solde ventes − rachats. En dessous, la caisse du jour et des 7 derniers
  jours, les boutons Nouvel achat, Nouvelle vente et Mouvement de caisse, et
  les dernières écritures.
- **Achat / Vente** : trois gros boutons, Nouvel achat, Nouvelle vente et
  Mouvement de caisse, au-dessus du registre. Chacun ouvre le formulaire sur sa propre page, et
  l'écriture enregistrée ramène au registre. Une vente ou un achat peut
  porter sur plusieurs marchandises à la fois, 25 au plus pour tenir sur une
  page du registre (« Ajouter une marchandise », la corbeille pour en
  retirer une ; une marchandise par ligne : article, quantité, montant), avec le total en septims qui se met à
  jour pendant qu'on remplit ; le client et les notes valent pour toutes, et
  chaque marchandise devient sa propre ligne du registre, toutes inscrites
  ensemble ou aucune. Chaque ligne porte sur une
  marchandise du stock ou sur un article libre hors stock ; la marchandise
  se choisit dans un champ où l'on tape son nom, comme dans le calculateur
  des Tarifs, la liste gardant ses catégories. Le montant est
  calculé avec le tarif ; le crayon permet de le changer. Sous le stock de
  la marchandise choisie, la ligne montre le prix par défaut qui sert à ce
  calcul (prix de rachat ou de vente, de gros ou citoyen selon le cas). À l'achat d'une
  marchandise qui a un prix pour les citoyens d'Estemarche, la case « Le
  vendeur est citoyen d'Estemarche » calcule le montant à ce prix ; il n'y a
  qu'une case par achat, pour le vendeur, qui vaut pour toutes ses
  marchandises qui ont ce prix. À droite de « Retour au registre », « Passer
  en vente » (ou « Passer en achat ») ouvre l'autre formulaire avec tout ce
  qui est déjà rempli : marchandises, quantités, client, notes, cases ; un
  montant calculé avec le tarif est recalculé avec celui de l'autre côté, un
  montant tapé à la main est gardé. Le stock bouge :
  +quantité à l'achat, −quantité à la vente, jamais sous zéro. Le registre se
  filtre par opération, par employé (le membre qui a inscrit la ligne) et par
  dates (heure de Paris). L'auteur d'une ligne ou
  un gérant peut l'annuler : elle reste barrée, ne compte plus dans la caisse,
  et le stock revient à l'état d'avant. Qui n'a pas encore déposé (vente) ou
  pris (achat) les septims dans la caisse coche « Je n'ai pas encore déposé /
  pris les septims dans la caisse » : toute l'écriture porte alors le statut
  *En attente de la caisse*, le stock bouge mais ses septims ne comptent pas
  dans la caisse (une tuile du registre en donne le total, et le filtre
  Opération « En attente de la caisse » les retrouve). Son auteur ou un gérant
  clique ensuite sur le bouton de l'écriture, « 58 septims pris » ou « 60
  septims déposés » (son total), dans le registre ou sur la page d'activité
  du membre : toutes les lignes de l'écriture comptent alors dans la caisse,
  et la confirmation, pour une écriture de plusieurs lignes, les liste avec
  leur total. Dans ces deux listes, chaque écriture forme un bloc, même d'une
  seule ligne : une carte encadrée d'un trait fin, une barre dorée à gauche, un espace entre deux cartes, et la date, l'opération, le client,
  l'employé et les notes écrits sur sa première ligne seulement. Un **mouvement de caisse** fait entrer
  ou sortir des septims sans marchandise (salaires, apport du gérant…) : sens,
  montant, motif, et l'aperçu de la caisse après lui. Tout membre peut en
  inscrire ; il a le badge *Caisse* dans le registre et son propre filtre.
- **Annonces** : le tableau du comptoir, des parchemins épinglés sur du bois
  (titre, texte, auteur, date). Chacun en accroche avec « Afficher un
  parchemin » et choisit ce qui le fixe : couteau, hache nordique ou morceau
  de viande. L'auteur d'une annonce ou un gérant peut la décrocher. Le Grand
  livre montre tout le tableau d'un coup, sans pagination (choix du
  propriétaire) ; la page Annonces le montre 12 parchemins par page.
- **Fournisseurs** : une carte par fournisseur, avec son lieu, une note
  (qui il représente…) et les marchandises du comptoir qu'il vend, chacune à
  son prix (« 1 septim pour 6 pièces »). Une recherche trouve un nom, un lieu
  ou une marchandise. Tout le monde les consulte ; seuls les gérants en
  ajoutent, les modifient (nom, lieu, note, marchandises et prix) ou les
  suppriment, par les boutons de la page.
- **Tarifs**, **Inventaire** (en tête, les septims en caisse, calculés comme
  la trésorerie du Grand livre, sans les septims en attente de la caisse ;
  entrées et sorties avec motif ; le bouton
  « Nouvelle marchandise » fait entrer en stock une marchandise qui n'existe
  pas encore : tout membre la crée, sans prix, avec nom, catégorie, unité,
  quantité et motif, et un gérant règle ses prix ensuite dans Gérer les
  tarifs ; quand la recherche du stock ne trouve rien, le formulaire reprend
  le nom cherché ; l'historique
  des mouvements se cherche par marchandise, en filtrant pendant qu'on tape,
  et se filtre par employé, par sens, entrées ou sorties, et par dates, heure
  de Paris), et pour les
  gérants **Membres** et **Gérer les tarifs** (créer et modifier les
  marchandises et leurs prix), qu'on ouvre par le bouton du même nom sur la
  page Tarifs. Une marchandise peut avoir un second prix de rachat, pour les
  citoyens d'Estemarche (le cuir : 4 septims pour eux, 3 pour les autres) ;
  vide, tout le monde a le même prix. Les Tarifs le montrent en évidence (une
  tuile à lui pour le cuir, une étiquette dorée dans les tableaux).
  Tarifs et Gérer les tarifs ont la même recherche par nom, qui filtre
  pendant qu'on tape, comme celle de l'Inventaire ; sur Tarifs, chacune des
  deux tables (peaux ; viandes et ressources) a la sienne. Tarifs montre
  d'abord les tarifs du cuir et le calculateur, réglé sur le cuir à
  l'ouverture, dont le choix de la marchandise se cherche en tapant parmi
  toutes les marchandises qui ont un prix, puis les tables. Les tables ne montrent que les marchandises qui ont
  un prix ; un bouton sous chacune montre ses marchandises sans tarif dans
  une table à part, sous le bouton, rangée par nom. Quand la recherche d'une
  table trouve moins de 10 marchandises, avec ou sans tarif, ses sans tarif
  s'affichent d'office, sans bouton. Pour un gérant, chaque ligne a un crayon qui ouvre la fiche de la
  marchandise dans Gérer les tarifs ; l'enregistrer ramène aux Tarifs.
- **Activité d'un membre** : chacun ouvre la sienne en cliquant sur son nom,
  en haut à droite ; un employé ne voit que la sienne, un gérant voit celle de
  tous par le bouton « Activité » de chaque ligne de Membres. Elle montre ce
  que le membre a fait sur une période, par défaut
  les 7 derniers jours, aujourd'hui compris (dates modifiables, heure de
  Paris), dans une seule liste paginée : ses achats, ventes, mouvements de
  caisse et mouvements de stock faits à la main (ceux des achats et des
  ventes sont leur ligne). En tête, quatre totaux : les **achats**
  (septims payés), les **ventes** (septims encaissés), l'**inventaire**
  (unités entrées et sorties à la main, hors achats et ventes, et leur
  valeur au prix de vente d'aujourd'hui, gros compris) et les **mouvements
  de caisse** (septims entrés moins sortis, sans marchandise). Les lignes
  annulées ne comptent pas, ni celles en attente de la caisse, qui portent
  ce statut dans la liste et le bouton de leur écriture ; une marchandise sans prix de vente est
  laissée hors de la valeur de l'inventaire, et la page le dit. Chaque
  mouvement de stock né d'une écriture (vente, achat ou son annulation)
  garde le numéro de sa ligne, pour le distinguer de ceux faits à la main.
- Sont paginés : le registre, l'historique du stock, les cartes du stock, les
  marchandises (avec une recherche par nom), les membres, l'activité d'un
  membre, les annonces et les fournisseurs (12 par page).
- Les marchandises (Gérer les tarifs, sections des Tarifs, choix
  d'Achat/Vente), les membres et les fournisseurs sont rangés par nom, de A
  à Z, sans tenir compte des majuscules ni des accents ; les marchandises
  archivées viennent en dernier. Les cartes du stock de l'Inventaire montrent
  d'abord les cuirs, puis les viandes, puis les peaux, puis tout le reste, chaque groupe
  rangé par nom de la même façon. Seule une carte en rupture porte une
  étiquette (« Rupture ») ; une carte en stock n'en a pas. Le registre, l'historique du stock et les annonces
  restent du plus récent au plus ancien.

## Rôles

- Au premier lancement, la page de connexion crée le compte du **gérant**,
  qui est aussi le **super admin** : il a toujours tous les droits d'un
  gérant, et lui seul peut modifier son compte (nom, rôle, mot de passe) ;
  aucun autre gérant ne peut le rétrograder, le désactiver ni changer son mot
  de passe. Dans une base qui existait avant ce rôle, la migration le donne au
  premier gérant créé.
- Un visiteur non connecté qui ouvre une page du comptoir passe par la page
  de connexion, puis revient sur cette page, avec ses filtres (paramètre
  `suite` de `/connexion`). Seul un chemin du comptoir lui-même est suivi ;
  tout autre lien ramène au Grand livre.
- Le gérant crée les comptes des **employés** (identifiant + mot de passe
  provisoire) depuis la page Membres, peut réinitialiser un mot de passe ou
  **désactiver** un compte.
- Chacun change son mot de passe avec la clé, en haut à droite.
