# Ce que fait l'app

La spécification du comportement : pages, règles métier et rôles. Un
comportement décrit ici est un comportement à garder ; le changer met ce
fichier à jour dans le même commit.

## Sommaire

- [Partout](#partout) : téléphone, pagination, ordre des listes
- [Boutiques](#boutiques) : adresses, Mes boutiques, réglages, invitations
- [Grand livre](#grand-livre)
- [Achat, Vente et registre](#achat-vente-et-registre)
- [Mouvement de caisse](#mouvement-de-caisse)
- [Annonces](#annonces)
- [Fournisseurs](#fournisseurs)
- [Tarifs et Gérer les marchandises](#tarifs-et-gérer-les-marchandises)
- [Inventaire](#inventaire)
- [Activité d'un membre](#activité-dun-membre)
- [Rôles et comptes](#rôles-et-comptes)

## Partout

- En haut du menu, le logo et « REGISTRE de Lomone » (Lomone est le
  personnage du propriétaire dans Keizaal), sur toutes les boutiques.
- L'onglet du navigateur porte le nom de la boutique sur toutes ses pages ;
  hors d'une boutique (connexion, Mes boutiques, invitation), « Registre de
  Lomone ».

### Téléphone et petites fenêtres

L'app se sert aussi au téléphone, en jeu, et dans une fenêtre de n'importe
quelle taille : rien ne déborde sur le côté ni ne se colle.

Sur un écran étroit :

- le menu tient en une ligne qui défile de côté, sous le nom de l'app et
  du membre ;
- les filtres (opération, employé, dates) passent à un par ligne, champs
  alignés ;
- les boutons du Grand livre passent deux par deux (achat et vente à
  droite), puis un par ligne sur les plus petits téléphones.

Dès que leur cadre est trop étroit pour leurs colonnes, quelle que soit la
fenêtre :

| Liste | Devient |
| --- | --- |
| Registre, activité d'un membre, historique du stock | une carte par écriture : article, quantité et septims sur une ligne, boutons dessous |
| Tarifs, Gérer les marchandises, comptes (Membres) | une fiche par ligne ; les en-têtes des Tarifs restent au-dessus, en boutons de tri |

### Pagination

| Liste | Par page |
| --- | --- |
| Registre, historique du stock, marchandises (avec une recherche par nom), membres, activité d'un membre | 25 |
| Cartes du stock | 24 |
| Annonces, fournisseurs | 12 |

Une écriture d'achat ou de vente porte au plus 25 marchandises, pour tenir
sur une page du registre.

### Ordre des listes

| Liste | Ordre |
| --- | --- |
| Marchandises (Gérer les marchandises, sections des Tarifs avant un tri par en-tête, choix d'Achat/Vente), membres, fournisseurs | par nom, de A à Z, sans tenir compte des majuscules ni des accents ; marchandises archivées en dernier |
| Cartes du stock (Inventaire) | cuirs, puis viandes, puis peaux, puis le reste ; chaque groupe par nom comme ci-dessus |
| Registre, historique du stock, annonces | du plus récent au plus ancien |

Les filtres de dates (registre, historique du stock, activité d'un membre)
sont à l'heure de Paris.

## Boutiques

L'app héberge plusieurs boutiques ; « Le Comptoir Des Chasseurs » est la
première. Ses textes sont génériques : ce qui est propre à une boutique (son
nom, ses marchandises, ses annonces…) vient de sa base, jamais du code. Chacune a ses marchandises, son registre, son tableau, ses
fournisseurs, ses réglages et ses membres, et ne voit rien des autres.

### Adresses

- Chaque boutique a ses pages sous son adresse : `/<slug>` pour son Grand
  livre, `/<slug>/inventaire`, `/<slug>/achat-vente`… (`lib/paths.ts`).
- Le comptoir est `/le-comptoir-des-chasseurs` ; ses anciennes adresses
  (`/inventaire`, `/achat-vente/vente`…) y mènent toujours (`next.config.ts`).
- Une adresse qui ne nomme aucune boutique n'existe pas.
- La racine `/` ouvre la boutique du membre s'il n'en a qu'une, et sinon Mes
  boutiques.
- Le nom de la boutique est en haut de chaque page ; « Changer de boutique »,
  en bas du menu, mène à Mes boutiques.

### Mes boutiques

- `/boutiques` : en haut, le compte connecté et « Se déconnecter » ; puis
  une carte par boutique du compte : son nom, son adresse, son nombre de
  membres actifs, le rôle du compte (badge Gérant ou Employé), un bouton
  « Entrer » et, pour un gérant, un lien vers ses Réglages.
- Seul le super admin y **ouvre une boutique**, en lui donnant un nom : il en
  devient le gérant, et elle prend l'adresse tirée du nom (« Forge de
  Vendeaume » → `/forge-de-vendeaume`). Un nom dont l'adresse est déjà prise,
  ou réservée par l'app (`connexion`, `inventaire`…), est refusé. Les autres
  comptes voient « Pour ouvrir une nouvelle boutique, demande au super
  admin. »
- Le super admin y **ouvre aussi une boutique pour quelqu'un** : il reçoit un
  lien d'invitation (`/invitation/<jeton>`) à lui donner. Les liens pas
  encore utilisés restent listés sous « Invitations en attente », avec
  l'adresse de la boutique, la date de création et un bouton « Copier ».

### Réglages (gérants)

- `/<slug>/reglages` : renommer la boutique, changer son adresse (le
  comptoir garde la sienne, où mènent ses anciens liens).
  Sous les champs, le lien complet de la boutique suit l'adresse pendant
  qu'on la tape.
- **Supprimer** la boutique avec tout ce qu'elle contient, après avoir retapé
  son nom. Le comptoir ne se supprime pas, ni la seule boutique d'un gérant.
- Les comptes de ses membres restent ; un compte resté sans aucune boutique
  ne peut plus se connecter, comme un compte désactivé.

### Invitation

- `/invitation/<jeton>` : qui ouvre le lien devient gérant de la boutique,
  avec son compte (connecté, ou après « J'ai déjà un compte ») ou un compte
  qu'il crée là.
- Le lien ne sert qu'une fois.

## Grand livre

- **Quatre tuiles sur tout le registre**, comme dans l'ancienne app :
  - la trésorerie actuelle : ventes encaissées − achats payés ± mouvements
    de caisse (la tuile donne leur total) ;
  - le total des ventes ;
  - le total des rachats ;
  - le solde ventes − rachats.
- En dessous : la caisse du jour et des 7 derniers jours.
- Les boutons : Mouvement de caisse, Mouvement de stock, puis, mis en avant à
  droite, Nouvel achat et Nouvelle vente.
- Les dernières écritures.
- Tout le tableau des annonces, sans pagination (choix du propriétaire).

## Achat, Vente et registre

### La page

Trois gros boutons au-dessus du registre : **Nouvel achat**, **Nouvelle
vente**, **Mouvement de caisse**. Chacun ouvre son formulaire sur sa propre
page ; l'écriture enregistrée ramène au registre.

### Le formulaire d'achat ou de vente

- **Plusieurs marchandises** par écriture, 25 au plus (§ Pagination) : « Ajouter une marchandise », la corbeille pour en
  retirer une.
- Une ligne par marchandise : article, quantité, montant. Une ligne porte sur
  une marchandise du stock ou sur un article libre hors stock.
- La marchandise se choisit dans un champ où l'on tape son nom (comme dans le
  calculateur des Tarifs) ; la liste garde ses catégories.
- **Montant** : calculé avec le tarif ; le crayon permet de le changer. Sous
  le stock de la marchandise choisie, la ligne montre le prix par défaut qui
  sert au calcul (rachat ou vente, gros ou citoyen selon le cas).
- **Total** en septims, mis à jour pendant qu'on remplit.
- **Client et notes** valent pour toutes les lignes.
- **Citoyen d'Estemarche** (achat seulement) : une seule case par achat,
  « Le vendeur est citoyen d'Estemarche ». Elle calcule au prix citoyen
  toutes les marchandises de l'achat qui en ont un.
- **« C'est une vente » / « C'est un achat »**, à droite de « Retour au
  registre », ouvre l'autre formulaire avec tout ce qui est rempli
  (marchandises, quantités, client, notes, cases). Un montant calculé est
  recalculé avec le tarif de l'autre côté ; un montant tapé à la main est
  gardé.
- **Stock insuffisant** : vendre plus que le stock (toutes les lignes d'une
  même marchandise comptées ensemble) n'est pas bloqué. Sur la ligne, le
  stock s'affiche en orange avec un panneau d'avertissement (« la vente
  passera quand même, et le stock descendra à 0 »), et l'on peut confirmer.
- **Enregistrement** : chaque marchandise devient sa propre ligne du
  registre ; toutes sont inscrites ensemble, ou aucune.

### Effet sur le stock

| Opération | Stock |
| --- | --- |
| Achat | + quantité |
| Vente | − quantité, mais jamais sous zéro : sans assez de stock, seul ce qui reste sort |
| Annulation | revient à l'état d'avant : remet ce qui est sorti du stock, pas la quantité vendue |

Chaque mouvement de stock né d'une écriture (vente, achat ou son annulation)
garde le numéro de sa ligne, pour le distinguer de ceux faits à la main. Une
vente faite sans rien en stock a quand même son mouvement, de 0, dans
l'historique du stock.

### Pas encore en caisse

Pour qui n'a pas encore déposé (vente, entrée d'argent) ou pris (achat,
sortie d'argent) les septims :

1. Il coche « Pas encore mis en caisse » (vente, entrée) ou « Pas encore
   sorti de la caisse » (achat, sortie). Toute l'écriture porte le statut
   *Pas encore en caisse* : le stock bouge, mais les septims ne comptent pas
   dans la caisse.
2. Une tuile du registre donne leur total ; le filtre Opération « Pas encore
   en caisse » les retrouve.
3. Plus tard, l'auteur ou un gérant clique sur le bouton de l'écriture, dans
   le registre ou sur la page d'activité du membre : « Sortir 58 septims de
   la caisse » ou « Mettre 60 septims en caisse » (le total de l'écriture).
   Toutes ses lignes comptent alors dans la caisse. Pour une écriture de
   plusieurs lignes, la confirmation les liste avec leur total.

### Le registre

- **Filtres** : opération, employé (le membre qui a inscrit la ligne),
  dates.
- **Annuler une ligne** : son auteur ou un gérant. Elle reste barrée, ne
  compte plus dans la caisse, et le stock revient à l'état d'avant.
- **Une écriture = un bloc**, même d'une seule ligne, dans le registre comme
  dans l'activité d'un membre : une carte encadrée d'un trait fin, une barre
  dorée à gauche, un espace entre deux cartes. La date, l'opération, le
  client, l'employé et les notes ne sont écrits que sur sa première ligne.

## Mouvement de caisse

- Fait entrer ou sortir des septims sans marchandise (salaires, apport du
  gérant…).
- Champs : sens, montant, motif ; l'aperçu de la caisse après le mouvement.
- Une case « Pas encore mis en caisse » ou « Pas encore sorti de la caisse »,
  comme pour un achat ou une vente (voir [Pas encore en
  caisse](#pas-encore-en-caisse)).
- Tout membre peut en inscrire.
- Dans le registre : badge *Caisse* et son propre filtre.

## Annonces

- Le tableau de la boutique : des parchemins épinglés sur du bois (titre,
  texte, auteur, date).
- Chacun en accroche avec « Afficher un parchemin » et choisit ce qui le
  fixe : couteau, hache nordique ou morceau de viande.
- L'auteur d'une annonce ou un gérant peut la décrocher, ou la modifier
  (crayon : titre, texte, attache). Elle garde sa place et sa date, et on
  revient au tableau d'où on est parti.
- 12 parchemins par page ici ; le Grand livre montre tout le tableau.

## Fournisseurs

- Une carte par fournisseur : son lieu, une note (qui il représente…), et
  les marchandises de la boutique qu'il vend, chacune à son prix (« 1 septim
  pour 6 pièces »).
- Une recherche trouve un nom, un lieu ou une marchandise.
- Tout le monde les consulte. Seuls les gérants en ajoutent, les modifient
  (nom, lieu, note, marchandises et prix) ou les suppriment, par les boutons
  de la page.

## Tarifs et Gérer les marchandises

### Prix citoyen

Une marchandise peut avoir un second prix de rachat, pour les citoyens
d'Estemarche (le cuir : 4 septims pour eux, 3 pour les autres). Vide, tout le
monde a le même prix. Les Tarifs le montrent en évidence : une tuile à lui
pour le produit phare, une étiquette dorée dans les tableaux.

### Tarifs (tous les membres)

Dans l'ordre de la page :

1. Le produit phare, choisi par un gérant dans Gérer les marchandises (le cuir tant
   qu'aucun autre n'est choisi, ou si le choisi est archivé) : ses prix de
   rachat et de vente en tuiles ; pour le cuir, le rachat par le forgeron en
   plus.
2. Le calculateur, réglé sur le produit phare à l'ouverture ; la marchandise se
   cherche en tapant, parmi toutes celles qui ont un prix.
3. La grille des prix (« Marchandises ») : une seule recherche par nom,
   qui filtre pendant qu'on tape, puis une grille par catégorie : peaux
   (transformation et bénéfice par lot), viandes et venaison, autres
   ressources (où va aussi le cuir quand il n'est pas le produit phare). Le
   produit phare n'y est pas : il a ses tuiles en haut.

Dans la grille :

- seules les marchandises qui ont un prix sont listées ;
- une recherche ne montre que les catégories où elle trouve une marchandise
  avec un prix ; si elle ne trouve rien du tout, un seul « Aucune marchandise
  ne correspond. », sans catégorie ;
- un bouton sous les grilles montre les marchandises sans tarif, toutes
  catégories, dans une table à part avec leur catégorie, sous le bouton,
  rangée par nom ;
- quand la recherche trouve moins de 10 marchandises (avec ou sans tarif),
  les sans tarif s'affichent d'office, sans bouton ;
- pour un gérant, chaque ligne a un crayon qui ouvre la fiche de la
  marchandise dans Gérer les marchandises ; l'enregistrer ramène aux Tarifs.
- chaque grille (et la table des sans tarif) se trie en cliquant un en-tête :
  un clic du plus petit au plus grand (de A à Z pour les noms), le suivant
  dans l'autre sens. Les prix se comparent à l'unité (2 septims pour 4
  unités avant 1 septim l'unité), le bénéfice aussi ; une case vide (« — »)
  reste en bas dans les deux sens. En fiches, les en-têtes restent au-dessus,
  en boutons. Le tri ne dure que le temps de la page.

### Gérer les marchandises (gérants)

- S'ouvre par le bouton du même nom sur la page Tarifs.
- Créer et modifier les marchandises et leurs prix.
- Choisir le produit phare des Tarifs, parmi les marchandises non archivées.
- Régler le prix de rachat du cuir par le forgeron, qui sert au bénéfice des
  peaux.
- Même recherche par nom que les Tarifs et l'Inventaire.

## Inventaire

### En tête

Les septims en caisse, calculés comme la trésorerie du Grand livre, sans
les septims *Pas encore en caisse*.

### Cartes du stock

Une carte par marchandise, dans l'ordre de [§ Ordre des listes](#ordre-des-listes).
Seule une carte en rupture porte une étiquette (« Rupture »).

### Mouvement de stock

Le bouton « Mouvement de stock » (ici et sur le Grand livre) ouvre son
formulaire sur sa propre page. Il fait entrer ou sortir des marchandises,
sans septims :

- le sens ;
- une marchandise par ligne, avec sa quantité et son stock après le
  mouvement (« Ajouter une marchandise », la corbeille, 25 au plus comme pour
  un achat) ;
- un motif commun.

Tout est inscrit ensemble ou rien, jamais sous zéro. L'enregistrement ramène
à l'Inventaire, qui le confirme. Dans l'historique et l'activité du membre,
les mouvements inscrits ensemble forment une carte, comme une écriture du
registre.

### Nouvelle marchandise

- Le bouton « Nouvelle marchandise » fait entrer en stock une marchandise
  qui n'existe pas encore.
- Tout membre la crée : nom, catégorie, unité, quantité, motif. Un employé
  la crée sans prix ; un gérant règle ses prix ensuite dans Gérer les
  marchandises.
- Un gérant a en plus la case « Ajouter des prix » : cochée, elle montre les
  mêmes champs de prix que Gérer les marchandises (achat, prix citoyen,
  vente, gros, et transformation en cuir pour une peau), enregistrés avec la
  marchandise.
- Quand la recherche du stock ne trouve rien, le formulaire reprend le nom
  cherché.
- À côté, un gérant a le bouton « Gérer les marchandises », qui mène à la
  page du même nom.

### Historique des mouvements

- Chaque entrée ou sortie porte son motif.
- Recherche par marchandise, qui filtre pendant qu'on tape.
- Filtres : employé, sens (entrées ou sorties), dates.

## Activité d'un membre

### Qui la voit

| Membre | Accès |
| --- | --- |
| Employé | la sienne seulement, en cliquant sur son nom en haut à droite |
| Gérant | la sienne de la même façon, et celle de tous par le bouton « Activité » de chaque ligne de Membres |

### Ce qu'elle montre

Ce que le membre a fait sur une période, par défaut les 7 derniers jours,
aujourd'hui compris (dates modifiables), dans une seule liste paginée : ses
achats, ventes, mouvements de caisse et mouvements de stock faits à la main
(ceux des achats et des ventes sont leur ligne).

En tête, quatre totaux :

| Total | Ce qu'il compte |
| --- | --- |
| Achats | septims payés |
| Ventes | septims encaissés |
| Inventaire | unités entrées et sorties à la main (hors achats et ventes), et leur valeur au prix de vente d'aujourd'hui, gros compris |
| Mouvements de caisse | septims entrés − sortis, sans marchandise |

Ne comptent pas :

- les lignes annulées ;
- les lignes *Pas encore en caisse*, qui portent ce statut dans la liste,
  ainsi que le bouton de leur écriture ;
- dans la valeur de l'inventaire, une marchandise sans prix de vente ; la
  page le dit.

## Rôles et comptes

### Comptes et boutiques

- Un compte (identifiant, mot de passe, nom affiché) peut appartenir à
  plusieurs boutiques, avec un rôle dans chacune (`shop_members`).
- Un compte sans boutique où il est actif ne peut plus se connecter.
- Seul le super admin ouvre une boutique : pour lui, ou pour quelqu'un
  d'autre par un lien d'invitation (voir [Mes boutiques](#mes-boutiques)).

### Qui peut quoi

| Rôle | Peut |
| --- | --- |
| **Super admin** | tout ce que fait un gérant, dans toutes les boutiques ; seul à ouvrir une boutique ; seul à pouvoir modifier son propre compte (nom, rôle, mot de passe) |
| **Gérant** | ouvrir la page Membres et Gérer les marchandises ; créer les comptes des employés de sa boutique (identifiant + mot de passe provisoire) depuis Membres ; réinitialiser un mot de passe ; désactiver un compte dans sa boutique |
| **Employé** | les pages de sa boutique, sauf Membres et Gérer les marchandises, et sauf les gestes que les sections ci-dessus réservent aux gérants |

- La page Membres, réservée aux gérants, ne montre que les membres de la
  boutique.
- Chacun change son mot de passe avec la clé, en haut à droite.

### Le super admin

- Au premier lancement, la page de connexion crée le compte du gérant, qui
  est aussi le super admin : il est gérant dans toutes les boutiques.
- Aucun autre gérant ne peut le rétrograder, le désactiver ni changer son mot
  de passe.
- Dans une base qui existait avant ce rôle, la migration le donne au compte
  `jesuisuncaillou` (le propriétaire), s'il existe.

### Connexion

- Un visiteur non connecté qui ouvre une page d'une boutique passe par la page
  de connexion, puis revient sur cette page, avec ses filtres (paramètre
  `suite` de `/connexion`).
- Seul un chemin de l'app elle-même est suivi ; tout autre lien ramène à `/`.
- Un compte qui ouvre une boutique où il n'a pas de rôle revient à `/` ; un
  employé qui ouvre une page de gérant revient au Grand livre de sa
  boutique.
