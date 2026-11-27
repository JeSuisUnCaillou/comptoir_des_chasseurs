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
- [À régler](#à-régler) : mes septims pas encore en caisse, mon stock à déposer
- [Annonces](#annonces)
- [Contacts](#contacts)
- [Tarifs et Gérer les marchandises](#tarifs-et-gérer-les-marchandises)
- [Inventaire](#inventaire)
- [Contrats](#contrats) : ce qu'on nous demande, face au stock
- [Activité d'un membre](#activité-dun-membre)
- [Rôles et comptes](#rôles-et-comptes)

## Partout

- L'app s'appelle Codex enchanté (adresse codexomancien.vercel.app). En haut
  du menu et sur la connexion, le logo et « CODEX », « Enchanté par Lomone »
  en dessous (Lomone est le personnage du
  propriétaire dans le jeu), sur toutes les boutiques. Le logo est celui du
  Codex, sauf dans une boutique qui a téléversé le sien (§ Réglages).
- L'onglet du navigateur porte le nom de la boutique sur toutes ses pages,
  et son logo quand elle en a un (sinon celui du Codex) ; hors d'une
  boutique (connexion, Mes boutiques, invitation), « Codex enchanté » et le
  logo du Codex.
- En haut de chaque page d'une boutique, une notification « À régler » dit
  au membre connecté ce qu'il lui reste à faire : septims à mettre en
  caisse, à en sortir, marchandises à déposer. Un clic mène à sa page
  [À régler](#à-régler). Rien à régler : pas de notification. Sur un écran
  étroit, elle passe au-dessus du titre de la page.

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
| Annonces, contacts, contrats livrés | 12 |

Une écriture d'achat ou de vente porte au plus 25 marchandises, pour tenir
sur une page du registre.

### Ordre des listes

| Liste | Ordre |
| --- | --- |
| Marchandises (Gérer les marchandises, sections des Tarifs avant un tri par en-tête, choix d'Achat/Vente), membres, contacts | par nom, de A à Z, sans tenir compte des majuscules ni des accents ; marchandises archivées et membres désactivés en dernier |
| Cartes du stock (Inventaire) | le cuir, puis chaque catégorie dans son ordre ; chaque groupe par nom comme ci-dessus |
| Catégories (Gérer les marchandises, grilles des Tarifs, groupes des choix de marchandise, filtre du stock) | dans l'ordre choisi par un gérant (§ Catégories) |
| Registre, historique du stock, annonces | du plus récent au plus ancien |
| Contrats en cours | l'échéance la plus proche d'abord, puis ceux sans échéance, du plus récent au plus ancien ; les contrats livrés, du dernier livré au premier ; leurs marchandises par nom |

Les filtres de dates (registre, historique du stock, activité d'un membre)
sont à l'heure de Paris.

## Boutiques

L'app héberge plusieurs boutiques ; « Le Comptoir Des Chasseurs » est la
première. Ses textes sont génériques : ce qui est propre à une boutique (son
nom, ses marchandises, ses annonces…) vient de sa base, jamais du code. Chacune a ses marchandises, son registre, son tableau, ses
contacts, ses réglages et ses membres, et ne voit rien des autres.

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
  une carte par boutique du compte : son logo (s'il y en a un), son nom, son adresse, son nombre de
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
- **Logo** : le gérant choisit une image ; la page la réduit à 256 pixels de
  côté au plus (proportions gardées, en PNG) et l'affiche en aperçu avant
  « Enregistrer le logo ». Elle devient le logo en haut du menu, sur la carte
  de la boutique dans Mes boutiques et dans l'onglet du navigateur, sur les
  pages de cette boutique seulement. Un fichier que le navigateur ne sait pas
  lire comme une image est refusé avant l'envoi. « Retirer le logo » rend
  celui du Codex. L'image est rangée dans la base (`shop_logos`) et servie à
  `/<slug>/logo`, sans service de stockage à part.
- **Supprimer** la boutique avec tout ce qu'elle contient, après avoir retapé
  son nom. Le comptoir ne se supprime pas, ni la seule boutique d'un gérant.
- Les comptes de ses membres restent ; un compte resté sans aucune boutique
  ne peut plus se connecter, comme un compte désactivé.

### Invitation

- Deux sortes de liens `/invitation/<jeton>` : celui du super admin (« Tu es
  invité à gérer la boutique… ») fait de qui l'ouvre le gérant d'une nouvelle
  boutique ; celui d'un gérant (« Tu es invité à rejoindre la boutique… comme
  employé ») en fait un employé de la sienne.
- Qui ouvre le lien le prend avec son compte (connecté, ou après « J'ai déjà
  un compte »), avec un compte qu'il crée là (identifiant et mot de passe),
  ou avec « Entrer avec Discord » quand Discord est configuré : un Discord
  déjà lié entre avec son compte ; sinon un compte est créé sans mot de
  passe, avec l'identifiant Discord (suivi de `-2`, `-3`… s'il est pris) et
  le nom donné au lien, ou à défaut le nom affiché sur Discord.
- En créant un lien d'employé, le gérant peut lui donner un nom (facultatif) :
  la page du lien l'annonce (« sous le nom de… »), le formulaire de création
  de compte le pré-remplit, et la liste des liens en attente l'affiche. Un
  compte existant qui prend le lien garde son nom.
- Un lien d'employé ne change pas le rôle de quelqu'un qui est déjà membre de
  la boutique : il ne rétrograde pas un gérant et ne réactive pas un compte
  désactivé.
- Le lien ne sert qu'une fois.

## Grand livre

- **Quatre tuiles, depuis la dernière fin de semaine** : en gros, le chiffre
  depuis la dernière fin de semaine déclarée (depuis l'ouverture avant la
  première), et son petit titre dit depuis combien de jours il compte
  (« Ventes depuis 3 jours », « depuis aujourd'hui », « depuis
  l'ouverture » ; jours du calendrier à l'heure de Paris) ; en petit
  dessous, le total depuis la première ligne du registre, avec son nombre de
  jours (« 15 634 septims depuis 152 jours ») :
  - la trésorerie, à part : en gros, tout ce qu'il y a en caisse (ventes
    encaissées − achats payés ± mouvements de caisse) ; dessous, en gris, ce
    que la caisse a gagné ou perdu depuis la fin de semaine (« +16 septims
    depuis 1 jour »), et rien d'autre ;
  - les ventes ;
  - les rachats ;
  - le solde ventes − rachats.
- **Déclarer la fin de semaine** (gérant, en bas du cadre de la caisse, après
  confirmation) : les ventes, les rachats, leur solde et la variation de la
  trésorerie repartent de zéro. La caisse, les totaux et le registre ne
  changent pas. Le cadre dit qui a déclaré la dernière et quand.
- Les boutons : Mouvement de caisse, Mouvement de stock, puis, mis en avant à
  droite, Nouvel achat et Nouvelle vente.
- Les dernières écritures.
- Tout le tableau des annonces, sans pagination (choix du propriétaire).
- Sous le tableau, les contrats en cours, en cartes comme sur la page
  [Contrats](#contrats), avec « Tous les contrats → » ; rien quand aucun
  n'est en cours.

### Initialiser une nouvelle boutique

Une boutique ouverte depuis Mes boutiques (par le super admin, ou par un
lien d'invitation de gérant) est proposée à l'initialisation : tant qu'elle
n'a rien en stock, son Grand livre montre à ses gérants, au-dessus de la
caisse, « Initialiser la boutique » en deux étapes, faisables dans
n'importe quel ordre :

1. **La caisse** : « Septims dans la caisse » et « Mettre en caisse »
   inscrivent un mouvement de caisse en entrée, au motif « Caisse de
   départ ». L'étape est faite dès que le registre a une écriture.
2. **Le stock** : « Importer le stock » mène à [Régulariser le
   stock](#régulariser-le-stock), où les captures du coffre créent les
   marchandises et leur stock.

La proposition disparaît une fois le stock inscrit par la régularisation, ou
avec « Passer l'initialisation » ; elle ne revient pas. Les employés ne la
voient pas, ni le comptoir. Une boutique ouverte avant elle la reçoit
si elle était encore vide le jour où elle est arrivée (aucune marchandise
en stock, aucun mouvement de stock).

## Achat, Vente et registre

### La page

Trois gros boutons au-dessus du registre : **Nouvel achat**, **Nouvelle
vente**, **Mouvement de caisse**. Chacun ouvre son formulaire sur sa propre
page ; l'écriture enregistrée ramène au registre.

### Le formulaire d'achat ou de vente

- **Plusieurs marchandises** par écriture, 25 au plus (§ Pagination) : « Ajouter une marchandise », la corbeille pour en
  retirer une. La ligne ajoutée reçoit le curseur dans son choix de
  marchandise, prête à taper ; la liste s'ouvre dès qu'on tape (ou avec ↓),
  pas avant, pour ne pas cacher le bouton.
- Une ligne par marchandise : article, quantité, montant. Une ligne porte sur
  une marchandise du stock ou sur un article libre hors stock. Choisir
  « Autre article (hors stock)… » après avoir tapé un texte dans le champ
  remplit tout de suite le nom de l'article avec ce texte, qui reste
  modifiable. Quand le texte tapé ne correspond à aucune marchandise,
  « Autre article » est surligné, et Entrée ou Tab le choisit.
- **Acheter une marchandise que la boutique ne connaît pas encore** : un
  achat propose aussi « Nouvelle marchandise (entre en stock)… », avant
  « Autre article ». La ligne demande son nom (repris de ce qui a été tapé),
  sa catégorie et son unité ; à l'enregistrement, la marchandise est créée
  sans prix, comme depuis l'Inventaire, et la quantité achetée entre en
  stock avec l'achat. Tout membre le peut. Sur un achat, c'est elle qu'un
  texte qui ne correspond à rien surligne, et que Entrée ou Tab choisit. Un
  nom déjà pris par une marchandise, même archivée, est refusé. Annuler la
  ligne retire la quantité du stock et laisse la marchandise. Passée en
  vente (« C'est une vente »), la ligne devient un article hors stock du
  même nom.
- La marchandise se choisit dans un champ où l'on tape son nom (comme dans le
  calculateur des Tarifs) ; la liste garde ses catégories. Partout où l'on
  choisit ainsi une marchandise, Tab après avoir tapé prend le premier
  résultat (ou celui choisi aux flèches) et passe au champ suivant. Si rien
  ne correspond, le texte tapé reste et le formulaire refuse l'envoi tant
  qu'aucune marchandise de la liste n'est choisie ; dans le calculateur des
  Tarifs, qui n'envoie rien, le champ reprend la marchandise choisie.
- **Montant** : calculé avec le tarif ; le crayon permet de le changer. Sous
  le stock de la marchandise choisie, la ligne montre le prix par défaut qui
  sert au calcul (rachat ou vente, gros ou privilégié selon le cas).
- **Total** en septims, mis à jour pendant qu'on remplit.
- **Client et notes** valent pour toutes les lignes. Le nom du client ou du
  vendeur propose les [contacts](#contacts) pendant qu'on tape, ceux qui vont
  dans ce sens d'abord (les clients pour une vente, les fournisseurs pour un
  achat) ; Entrée envoie le formulaire tant qu'aucune proposition n'est
  choisie aux flèches. Un nom qu'aucun contact ne porte (majuscules mises à
  part) devient un contact à l'enregistrement, avec les notes de l'écriture
  pour note, l'étiquette « Créé lors d'une transaction », et chaque
  marchandise du stock de l'écriture au prix payé, dans « Il nous vend »
  pour un achat, « Il nous achète » pour une vente (plusieurs lignes d'une
  même marchandise additionnées, le prix réduit : 6 septims pour 2 peaux
  donnent « 3 septims pour 1 peau ») ; un article hors stock n'y va pas.
  Un nom connu s'inscrit tel que le contact l'écrit, et ses marchandises
  ne changent pas. Annuler l'écriture ne supprime pas
  le contact.
- **Prix privilégié du vendeur** (achat seulement) : un seul choix par achat,
  « Aucun » ou l'un des clients privilégiés qui ont un prix sur au moins une
  des marchandises. Il calcule à leur prix
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
- **« Rappelle-moi de déposer ça dans le stock »** (achat seulement,
  décochée d'avance) : l'achat rejoint le stock à déposer de son auteur
  (voir [À régler](#à-régler)). Ce n'est qu'un rappel : la marchandise entre
  dans l'inventaire à l'enregistrement, comme sans la case. Une ligne
  d'article hors stock n'a rien à déposer.
- **Enregistrement** : chaque marchandise devient sa propre ligne du
  registre ; toutes sont inscrites ensemble, ou aucune. Dans le registre et
  l'activité d'un membre, une écriture de plusieurs lignes porte son total
  (lignes annulées non comptées) sous le client ou le vendeur, et le même
  sur chaque page quand la pagination la coupe.

### Effet sur le stock

| Opération | Stock |
| --- | --- |
| Achat | + quantité |
| Vente | − quantité, mais jamais sous zéro : sans assez de stock, seul ce qui reste sort |
| Annulation | revient à l'état d'avant : remet ce qui est sorti du stock, pas la quantité vendue |
| Rétablissement | comme une nouvelle vente ou un nouvel achat de la ligne |

Chaque mouvement de stock né d'une écriture (vente, achat, son annulation ou
son rétablissement)
garde le numéro de sa ligne, pour le distinguer de ceux faits à la main. Une
vente faite sans rien en stock a quand même son mouvement, de 0, dans
l'historique du stock.

### Pas encore en caisse

Pour qui n'a pas encore déposé (vente, entrée d'argent) ou pris (achat,
sortie d'argent) les septims :

1. Il coche « Pas encore mis en caisse » (vente, entrée) ou « Pas encore
   sorti de la caisse » (achat, sortie). Toute l'écriture porte le statut
   *Pas encore en caisse* : le stock bouge, mais les septims ne comptent pas
   dans la caisse. Sur un achat ou une vente, la case est cochée
   d'avance : il la décoche s'il prend ou dépose les septims tout de suite.
   Passer d'un achat à une vente (ou l'inverse) garde la case comme elle est.
2. Une tuile du registre donne leur total ; le filtre Opération « Pas encore
   en caisse » les retrouve. Son auteur les retrouve aussi sur sa page
   [À régler](#à-régler), annoncée en haut de chaque page.
3. Plus tard, l'auteur ou un gérant clique sur le bouton de l'écriture, dans
   le registre ou sur la page d'activité du membre : « Sortir 58 septims de
   la caisse » ou « Mettre 60 septims en caisse » (le total de l'écriture).
   Toutes ses lignes comptent alors dans la caisse. Pour une écriture de
   plusieurs lignes, la confirmation les liste avec leur total.

### Le registre

- **Filtres** : opération, employé (le membre qui a inscrit la ligne),
  dates.
Les boutons qui changent une écriture sont les mêmes dans le registre et
sur la page d'activité d'un membre, pour son auteur ou un gérant. Un
mouvement de stock fait à la main a les mêmes, dans l'historique de
l'Inventaire et l'activité de son auteur (voir [Annuler ou modifier un
mouvement de stock](#annuler-ou-modifier-un-mouvement-de-stock)) :

- **Une écriture d'une seule ligne qui compte** : « Modifier » et
  « Annuler » sur la ligne. Sur une carte (téléphone, fenêtre étroite), ils
  sont juste sous son prix, à droite.
- **Une écriture de plusieurs lignes qui comptent** : ses lignes n'ont pas de
  bouton à elles ; sa première ligne porte, là où une ligne seule a les
  siens, « Modifier les transactions » et « Tout annuler », l'un sous
  l'autre et de même largeur pour ne pas élargir la ligne. « Tout annuler » annule toutes les lignes qui comptent encore ;
  la confirmation les liste, et elles changent toutes ensemble, ou aucune
  (un achat dont la marchandise est déjà vendue bloque tout).
- **Annuler** : la ligne reste barrée, ne compte plus dans la caisse, et le
  stock revient à l'état d'avant. Pour n'annuler qu'une ligne d'une écriture
  de plusieurs, « Modifier les transactions » les liste une par une sous
  « Annuler une seule ligne ».
- **Rétablir** : à côté de « Annulée par … », sur la même ligne, la fait
  compter de nouveau, comme si on l'inscrivait à nouveau : une vente ressort
  du stock ce qui y reste (jamais sous zéro, comme une vente), un achat y
  remet sa quantité. L'annuler encore rend ce qu'elle a vraiment pris la
  dernière fois. Quand une écriture a au moins deux lignes annulées, un seul
  « Tout rétablir », sur sa première ligne, les rétablit toutes, à la place des
  boutons de chaque ligne.
- **Modifier les montants** (« Modifier » ou « Modifier les transactions ») :
  une page avec les septims de chaque ligne de l'écriture (lignes annulées
  exclues), le total avant et après, et, pour plusieurs lignes, « Tout
  mettre à 0 ». Seuls les septims changent : le stock, les quantités et le
  statut *Pas encore en caisse* restent. La caisse, les tuiles et les totaux
  suivent, puisqu'ils sont recalculés depuis les lignes. Une vente ou un
  achat accepte 0, un mouvement de caisse au moins 1. L'enregistrement
  ramène là d'où l'on vient (le registre, qui confirme le nouveau total, ou
  la page d'activité) ; chaque ligne changée affiche « Modifiée par … ».
- **Une écriture = un bloc**, même d'une seule ligne, dans le registre comme
  dans l'activité d'un membre : une carte encadrée d'un trait fin, une barre
  dorée à gauche, un trait plus discret entre deux de ses lignes
  (en tableau, sous l'article, la quantité et les septims seulement), un espace entre deux cartes. La date, l'opération, le
  client, l'employé et les notes ne sont écrits que sur sa première ligne.

## Mouvement de caisse

- Fait entrer ou sortir des septims sans marchandise (salaires, apport du
  gérant…).
- Champs : sens, montant, motif ; l'aperçu de la caisse après le mouvement.
- « J'ai compté dans le coffre » (facultatif) : on tape les septims comptés,
  l'app remplit le sens et le montant de l'écart avec la caisse, et le motif
  « Correction de caisse » s'il est vide ; un compte égal à la caisse dit
  « La caisse est juste : rien à inscrire. ». Changer ensuite le sens, le
  montant ou la case ci-dessous à la main vide le compte.
- Si des écritures ne sont pas encore en caisse, un encadré le dit, avec un
  lien vers elles dans le registre : à valider ou annuler avant de compter.
- Une case « Pas encore mis en caisse » ou « Pas encore sorti de la caisse »,
  comme pour un achat ou une vente (voir [Pas encore en
  caisse](#pas-encore-en-caisse)).
- Tout membre peut en inscrire.
- Dans le registre : badge *Caisse* et son propre filtre.

## À régler

La page du membre connecté (`/<boutique>/a-regler`), où mène la
notification « À régler » du haut des pages. Elle ne montre que ce qu'il a
inscrit lui-même :

- **Mes septims** : ses écritures *Pas encore en caisse* et pas annulées,
  comme dans le registre, avec leur bouton « Mettre … en caisse » ou
  « Sortir … de la caisse » ; au-dessus, ce qu'il a en tout à mettre en
  caisse et à en sortir.
- **Mon stock à déposer** : ses achats inscrits avec « Rappelle-moi de
  déposer ça dans le stock », pas annulés, du plus ancien au plus récent :
  leurs marchandises (« 3 × Peau de loup, 2 × Cuir »), la date et le
  vendeur. « C'est déposé » retire le rappel de tout l'achat ; le stock ne
  bouge pas, il a bougé à l'achat.

Rien à régler : chaque partie le dit.

## Annonces

- Le tableau de la boutique : des parchemins épinglés sur du bois (titre,
  texte, auteur, date).
- Chacun en accroche avec « Afficher un parchemin » et choisit ce qui le
  fixe : couteau, hache nordique ou morceau de viande.
- L'auteur d'une annonce ou un gérant peut la décrocher, ou la modifier
  (crayon : titre, texte, attache). Elle garde sa place et sa date, et on
  revient au tableau d'où on est parti.
- En l'accrochant ou en la modifiant, son auteur ou un gérant peut cocher
  « Modifiable par tous les employés » (décoché par défaut) : tout membre de
  la boutique a alors le crayon. Seuls l'auteur et les gérants la décrochent
  et changent cette case ; les autres ne la voient pas en modifiant.
- 12 parchemins par page ici ; le Grand livre montre tout le tableau.

## Contacts

Les fournisseurs et les clients que la boutique veut suivre (pas forcément
tous), à l'adresse `/<boutique>/contacts`.

- Une carte par contact : son lieu, une note (qui il représente, ce qu'il
  fait de nos marchandises…), puis les marchandises de la boutique en deux
  listes, chacune à son prix (« 1 septim pour 6 pièces ») : « Il nous vend »
  et « Il nous achète ».
- L'étiquette de la carte suit ces listes : Fournisseur, Client, Fournisseur
  et client, ou Contact tant qu'il n'a aucune marchandise.
  Couleurs : un fournisseur a la carte dorée de l'app, un client une carte
  bleue ; fournisseur et client, la carte dorée avec un bord bleu à gauche.
  Ce qu'un contact nous achète a son titre et ses prix en bleu.
- Un contact créé par un achat ou une vente (§ [Le formulaire d'achat ou de
  vente](#le-formulaire-dachat-ou-de-vente)) porte, sur sa carte et sa fiche,
  l'étiquette « Créé lors d'une transaction ».
- Une marchandise va dans un seul sens par contact : l'enregistrer dans
  l'autre sens la déplace, avec son nouveau prix.
- Une recherche, qui filtre pendant qu'on tape, trouve un nom, un lieu, une note
  ou une marchandise.
- Tout le monde les consulte. Seuls les gérants en ajoutent, les modifient
  (nom, lieu, note, marchandises, sens et prix) ou les suppriment, par les
  boutons de la page. La marchandise d'un prix se cherche en tapant, comme
  dans Achat / Vente.

## Tarifs et Gérer les marchandises

### Clients privilégiés

Une boutique peut avoir des clients privilégiés : des groupes de vendeurs à
qui elle rachète à leur propre prix. Le comptoir a les « Citoyens
d'Estemarche » (le cuir : 4 septims pour eux, 3 pour les autres) ; une
nouvelle boutique n'en a aucun. Un gérant les nomme, les renomme et les
supprime dans Gérer les marchandises, cinq au plus ; supprimer un groupe
efface ses prix, après une seconde confirmation.

Chaque marchandise a un prix de rachat par groupe. Vide, le groupe a le prix
habituel. Les Tarifs les montrent en évidence : une tuile par groupe pour un
produit phare, une étiquette dorée par groupe dans les tableaux.

### Tarifs (tous les membres)

Dans l'ordre de la page :

1. Les produits phares, choisis par les gérants dans Gérer les marchandises,
   dans l'ordre qu'ils y ont réglé, à côté du calculateur : une ligne
   chacun, son nom puis ses prix de rachat et de vente côte à côte (deux par
   ligne au téléphone) ; pour le cuir, le rachat par le forgeron en plus ;
   son stock en dernier. Un
   produit phare archivé n'y est plus (il y revient si on le désarchive).
   Sans produit phare, le bloc le dit. Pour un gérant, un crayon sur le bloc
   ouvre le réglage.
2. Le calculateur, réglé sur le premier produit phare à l'ouverture ; la
   marchandise se cherche en tapant, parmi toutes celles qui ont un prix.
3. La grille des prix (« Marchandises ») : une seule recherche par nom,
   qui filtre pendant qu'on tape, puis une grille par catégorie de la
   boutique, à son nom (§ Catégories) ; celle des peaux montre la
   transformation et le bénéfice par lot. Au comptoir : Peaux, Viandes et
   venaison, Autres ressources (où va aussi le cuir), Composants
   alchimiques. Les produits phares y restent aussi, à leur place : leurs
   lignes en haut ne font que les mettre en avant.

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
- Choisir les produits phares des Tarifs, parmi les marchandises non
  archivées : en ajouter un (la marchandise se cherche en tapant ; il passe
  après les autres), changer l'ordre en le glissant par sa poignée (§ Glisser
  pour ordonner), le retirer. Le comptoir
  a gardé le cuir, son produit phare d'avant ; une nouvelle boutique n'en a
  aucun.
- Nommer les clients privilégiés de la boutique (§ Clients privilégiés).
- Régler le prix de rachat du cuir par le forgeron, qui sert au bénéfice des
  peaux.
- Gérer les catégories (§ Catégories).
- Même recherche par nom que les Tarifs et l'Inventaire.

### Glisser pour ordonner

Les produits phares et les catégories se rangent de la même façon : on saisit
la poignée d'une ligne (souris ou doigt) et les autres s'écartent pendant
qu'on la déplace ; l'ordre s'enregistre quand on la lâche. Au clavier, les
flèches haut et bas sur la poignée la montent ou la descendent d'un cran.

### Catégories

- Chaque boutique a ses catégories de marchandises ; une nouvelle boutique
  commence avec une seule, « Autres marchandises ». Chaque marchandise est
  dans une catégorie de sa boutique.
- Un gérant les renomme, en ajoute et en supprime dans Gérer les
  marchandises. Deux catégories d'une boutique n'ont pas le même nom. Une
  catégorie ne se supprime que vide (marchandises archivées comprises), et
  la boutique en garde au moins une. Chaque catégorie dit combien de
  marchandises elle contient.
- Un gérant change leur ordre en les glissant par leur poignée (§ Glisser
  pour ordonner). Les Tarifs, l'Inventaire et les formulaires le suivent ;
  une nouvelle catégorie va à la fin.
- Le comptoir a Peaux, Viandes et venaison, Autres ressources et Composants
  alchimiques. Sa catégorie des peaux le reste même renommée : ses
  marchandises se transforment en cuir par lots (champs « Peaux par lot » et
  « Cuirs obtenus », grille des peaux aux Tarifs, total « Peaux en réserve »).
  Son Cuir, rangé dans Autres ressources, reste le cuir : rachat par le forgeron
  sur sa ligne de produit phare, total « Cuirs en réserve ». Ces deux
  marques ne se règlent pas dans l'app : une autre boutique n'en a pas.

## Inventaire

### En tête

Les septims en caisse, calculés comme la trésorerie du Grand livre, sans
les septims *Pas encore en caisse*. Puis les peaux en réserve (si la
boutique a une catégorie des peaux), les cuirs en réserve (si elle a du
cuir), et le nombre des autres marchandises (« Marchandises » s'il n'y a ni
peaux ni cuir).

### Cartes du stock

Une carte par marchandise, dans l'ordre de [§ Ordre des listes](#ordre-des-listes).
Seule une carte en rupture porte une étiquette (« Rupture »).

### Mouvement de stock

Le bouton « Mouvement de stock » (ici et sur le Grand livre) ouvre son
formulaire sur sa propre page. Il fait entrer ou sortir des marchandises,
sans septims :

- le sens ;
- une marchandise par ligne, avec sa quantité et son stock après le
  mouvement (« Ajouter une marchandise », qui met le curseur dans la nouvelle ligne
  comme pour un achat, la corbeille, 25 au plus) ;
- un motif commun.

Tout est inscrit ensemble ou rien, jamais sous zéro. L'enregistrement ramène
à l'Inventaire, qui le confirme. Dans l'historique et l'activité du membre,
les mouvements inscrits ensemble forment une carte, comme une écriture du
registre.

### Régulariser le stock

Le bouton « Régulariser le stock », pour les gérants seulement, est le
bouton principal de l'Inventaire, à droite de « Mouvement de stock » (qui reste le
principal pour un employé). Il ouvre sa
page (`/<slug>/inventaire/regularisation`). Le gérant y donne les captures d'écran
d'un coffre du jeu (la liste de SkyUI en plein écran, 16:9), prises de haut en
bas de la liste, triée par nom. La page dit comment les prendre : une capture, défiler en
gardant au moins 3 lignes de la précédente, une capture, et ainsi de suite
jusqu'au bas du coffre. Elle prévient que personne ne doit vendre ni acheter
pendant la régularisation : le stock prend les comptes du coffre au moment
d'inscrire, et une vente faite entre-temps serait effacée. Ensuite :

- Les captures sont lues dans le navigateur (OCR) : elles ne quittent pas
  l'ordinateur. Seule la colonne des noms est lue, quel que soit l'onglet du
  coffre (Tous, Nourriture, Ingrédients, Divers…) : l'icône « volé » et ce
  qui la suit ne font pas partie du nom. Elles se recollent dans l'ordre de
  la liste du coffre, que le jeu trie par nom, quels que soient leurs noms
  de fichier ou leurs dates : chacune prend sa place d'après le nom de sa
  deuxième ligne (la première peut être coupée).
- Une capture qui reprend des lignes déjà lues (le bas de la précédente, ou
  plus haut quand la liste a été remontée) n'ajoute que ce qui les suit.
  Les deux captures sont alignées ligne à ligne en tolérant les accrocs de
  l'OCR : une ligne lue autrement, coupée en haut de la capture ou manquée
  sur l'une des deux. Il faut au moins deux lignes communes, et deux fois
  plus de lignes communes que d'accrocs. Une ligne que seule la seconde a
  lue, entre deux lignes communes, prend sa place dans la liste ; quand une
  ligne est lue sur les deux, c'est la lecture de la capture la plus haute
  dans la liste qui reste. Les lignes d'un
  même objet s'additionnent, volées ou non : « (13) » compte 13, une ligne
  sans nombre compte 1. Les lettres que l'OCR confond (« a » et « o »,
  « i », « l » et « t ») ne séparent pas deux lignes.
- Au-dessus de la relecture, « À propos des captures » prévient d'une
  capture qui n'est pas en 16:9, d'une capture sans aucun objet lu, et de
  deux captures qui n'ont aucune ligne en commun alors que la seconde
  continue la liste dans l'ordre alphabétique des objets (une page manque
  peut-être).
- Un comptage relit au plus 300 objets, les premiers lus. Au-delà, « À
  propos des captures » nomme ceux qui ne sont pas comptés et dit de faire
  l'import en plusieurs fois.
- La relecture montre une ligne par objet lu, en colonnes : son nom et ses
  lignes (« 255 + 1 »), la marchandise qu'il est, son stock, son compte
  (modifiable) et l'écart entre les deux (« +70 » en vert, « −16 » en
  rouge, « = » sans écart ; une « * » quand d'autres objets comptent pour la
  même marchandise).
  La marchandise est trouvée par un nom du jeu déjà rattaché, puis par son
  nom, puis par l'animal d'une peau (« Peau de loup » est Loup). Sinon,
  l'objet est sur « Ignorer » et le gérant choisit.
- Toucher le nom d'un objet montre, sous sa ligne, les lignes des captures
  d'où il a été lu, découpées dans les captures. Une petite flèche devant le
  nom le signale : elle pointe à droite, puis vers le bas une fois déplié.
- Garde-fous, en orange :
  - un objet non reconnu d'au moins 6 reçoit la marchandise au nom le plus
    proche (une lettre sur six d'écart au plus, jamais une marchandise
    qu'un autre objet est déjà), « Proposée : confirmer » jusqu'à ce que
    le gérant la confirme ou en change ;
  - un compte dont l'OCR n'est pas sûr est entouré, jusqu'à ce que le
    gérant le change ou regarde ses lignes de capture ;
  - un écart de plus de 100, ou d'au moins 10 et de plus de la moitié du
    stock, porte un ⚠.
  « Mettre le stock à jour » montre d'abord « À vérifier avant
  d'inscrire » s'il en reste : chaque point mène à sa ligne, puis
  « Inscrire quand même » ou « Revenir à la relecture ».
- Les « Reconnus » sont à gauche, les « Non reconnus » à droite (l'un sous
  l'autre sur un écran étroit, les reconnus d'abord). Un objet reste dans sa
  partie quand le gérant change sa marchandise.
- Un objet non reconnu peut devenir une « Nouvelle marchandise » : son nom
  (le nom lu d'office) et sa catégorie se règlent sous sa ligne. Pour une
  boutique qui commence son inventaire, « Créer les N ignorés dans cette
  catégorie » le fait d'un coup pour tous les objets encore sur « Ignorer »,
  et « Ne plus créer les N nouvelles » le défait. Elles sont créées sans
  prix (à régler dans Gérer les marchandises) avec le reste du comptage,
  tout ou rien ; un nom déjà pris, même archivé, est refusé.
- Un nom du jeu rattaché à une marchandise d'un autre nom (« Deer Pelt » à
  Biche) est retenu par la boutique pour les comptages suivants, même lu
  avec une lettre de travers (« Wolf Peli »). C'est aussi un nom alternatif :
  partout où l'on cherche ou choisit une marchandise (Tarifs, Inventaire,
  Gérer les marchandises, Contacts, les listes des formulaires), taper
  « deer » trouve Biche.
- Plusieurs objets rattachés à la même marchandise s'additionnent.
- « Mettre le stock à jour » donne à chaque marchandise comptée le stock
  compté, par des mouvements d'entrée ou de sortie avec le motif (« Régularisation
  du stock » d'office), inscrits ensemble comme un Mouvement de stock, et
  ramène à l'Inventaire qui les confirme. Une marchandise déjà juste n'a pas
  de mouvement ; une marchandise absente des captures garde son stock.

### Nouvelle marchandise

- Le bouton « Nouvelle marchandise » fait entrer en stock une marchandise
  qui n'existe pas encore.
- Tout membre la crée : nom, catégorie (parmi celles de la boutique, celle
  du filtre du stock d'office), unité, quantité, motif. Un employé
  la crée sans prix ; un gérant règle ses prix ensuite dans Gérer les
  marchandises.
- Un gérant a en plus la case « Ajouter des prix » : cochée, elle montre les
  mêmes champs de prix que Gérer les marchandises (achat, prix privilégiés,
  vente, gros, et transformation en cuir pour une peau), enregistrés avec la
  marchandise.
- Quand la recherche du stock ne trouve rien, le formulaire reprend le nom
  cherché.
- Un gérant a le bouton « Gérer les marchandises », qui mène à la page du
  même nom : le même qu'en Tarifs, au même endroit, à côté du titre de la
  page.

### Annuler ou modifier un mouvement de stock

Un mouvement de stock fait à la main (Mouvement de stock, Nouvelle
marchandise, Régulariser le stock) se corrige comme une écriture du
registre, par son auteur ou un gérant, dans l'historique des mouvements et
sur la page d'activité de son auteur, avec les mêmes boutons (voir [Le
registre](#le-registre)) : « Modifier » et « Annuler » sur un mouvement
d'une seule marchandise, « Modifier les transactions » et « Tout annuler »
sur la première ligne d'un mouvement de plusieurs, « Rétablir » ou « Tout
rétablir » une fois annulé. Les mouvements nés d'un achat ou d'une vente
n'en ont pas : ils se corrigent par leur ligne du registre.

- **Annuler** : ce qui est entré ressort du stock, ce qui est sorti y
  revient. Le mouvement reste barré, « Annulée par … », et ne compte plus
  dans le total « Inventaire » de l'activité. Refusé si le stock passerait sous
  zéro (« Impossible d'annuler : il ne reste que 3 Peau de lion en
  stock. ») ; pour plusieurs marchandises, toutes ou aucune.
- **Rétablir** : le mouvement compte de nouveau, comme la première fois ;
  refusé de même sous zéro.
- **Modifier** : une page (`/<slug>/inventaire/modifier/<id>`) avec la
  quantité de chaque marchandise du mouvement (annulées exclues), qui garde
  son sens (entrée ou sortie), au moins 1. Le stock suit l'écart, jamais
  sous zéro, tout ou rien. Pour plusieurs marchandises, « Annuler une seule
  ligne » les liste une par une. L'enregistrement ramène là d'où l'on vient
  (l'historique, avec ses filtres, ou la page d'activité) ; le mouvement
  affiche « Modifiée par … ».

### Historique des mouvements

- Chaque entrée ou sortie porte son motif.
- Recherche par marchandise, qui filtre pendant qu'on tape.
- Filtres : employé, sens (entrées ou sorties), dates.

## Contrats

Ce qu'on demande à la boutique (« cette semaine : 12 000 cuirs, 60 viandes
de worker et 60 peaux de loup »), à l'adresse `/<boutique>/contrats`, entre
Inventaire et Contacts dans le menu.

- Un contrat a un nom, un client et une échéance facultatifs, et les
  marchandises de la boutique qu'il demande, chacune avec sa quantité.
- « Nouveau contrat » prend tout d'un coup : nom, client, échéance et ses
  marchandises, une ligne chacune (« Ajouter une marchandise », la corbeille
  pour en retirer une ; 25 au plus, et une marchandise une seule fois). Le
  contrat créé, on revient aux Contrats. Sa fiche (« Modifier ») ajoute,
  change ou retire ensuite une marchandise : la redemander change sa
  quantité.
- Une carte par contrat en cours : pour chaque marchandise, le stock
  d'aujourd'hui face à la quantité demandée (« 40 / 60 peaux »), une barre,
  et ce qui manque (« Manque 20 peaux ») ou « Prêt » ; un stock au-delà de
  la demande se dit (« 80 en stock »). En tête, la progression d'ensemble :
  la moyenne des marchandises, chacune comptant autant quelle que soit sa
  quantité, et combien sont prêtes (« 2 marchandises prêtes sur 3 »).
- L'étiquette dit « En cours », ou « Prêt à livrer » quand tout est en
  stock ; « Échéance passée » s'ajoute après le jour dit (heure de Paris).
- Le stock compté est celui de l'Inventaire : deux contrats qui demandent
  la même marchandise voient le même stock.
- « Marquer comme livré » range le contrat sous « Contrats livrés »
  (étiquette « Livré ») ; « Rouvrir le contrat » le remet en cours. Le stock
  ne bouge pas : la livraison s'inscrit comme une vente dans Achat / Vente.
- Tout le monde les consulte. Seuls les gérants en créent, les modifient
  (nom, client, échéance, marchandises), les marquent livrés, les rouvrent
  ou les suppriment, par les boutons de la page.

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
(ceux des achats et des ventes sont leur ligne). Les colonnes « Client /
vendeur » et « Notes / motif » : un mouvement de stock n'a ni client ni
vendeur, son motif est dans la seconde. Le membre lui-même et les gérants
y ont les boutons du registre sur ses achats, ventes, mouvements de caisse
et mouvements de stock (mettre en caisse, modifier, annuler, rétablir : voir
[Le registre](#le-registre) et [Annuler ou modifier un mouvement de
stock](#annuler-ou-modifier-un-mouvement-de-stock)).

En tête, le **bilan en caisse**, en grand : ventes − achats ± mouvements de
caisse, ce que la caisse a gagné ou perdu par ce membre sur la période. À
côté, en plus petit, les trois totaux qui le font, et à part l'inventaire,
qui n'est pas de l'argent de la caisse :

| Total | Ce qu'il compte |
| --- | --- |
| Bilan en caisse | ventes − achats + entrées − sorties de caisse |
| Ventes | septims encaissés |
| Achats | septims payés |
| Mouvements de caisse | septims entrés − sortis, sans marchandise |
| Inventaire, à part | unités entrées et sorties à la main (hors achats et ventes), et leur valeur au prix de vente d'aujourd'hui, gros compris |

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
- Un compte sans boutique où il est actif ne peut plus se connecter, sauf
  le super admin.
- Seul le super admin ouvre une boutique : pour lui, ou pour quelqu'un
  d'autre par un lien d'invitation (voir [Mes boutiques](#mes-boutiques)).
- Un compte peut être lié à un compte Discord, par son propriétaire seulement
  (voir [Connexion](#connexion)). Un compte Discord n'est lié qu'à un seul
  compte. Discord ne crée un compte que par un lien d'invitation.

### Qui peut quoi

| Rôle | Peut |
| --- | --- |
| **Super admin** | tout ce que fait un gérant, dans toutes les boutiques ; seul à ouvrir une boutique ; seul à pouvoir modifier son propre compte (nom, rôle, mot de passe) |
| **Gérant** | ouvrir la page Membres et Gérer les marchandises ; régulariser le stock ; créer les comptes des employés de sa boutique (identifiant + mot de passe provisoire) depuis Membres, ou un lien d'invitation d'employé (« Inviter un employé », avec un nom facultatif) ; voir les liens pas encore utilisés, avec « Copier » ; réinitialiser un mot de passe ; désactiver un compte dans sa boutique |
| **Employé** | les pages de sa boutique, sauf Membres, Gérer les marchandises et Régulariser le stock, et sauf les gestes que les sections ci-dessus réservent aux gérants |

- La page Membres, réservée aux gérants, ne montre que les membres de la
  boutique.
- Le sélecteur de rôle d'une ligne de Membres passe de Gérant à Employé et
  retour ; il n'est pas sur la ligne d'un compte désactivé. Désactiver se
  fait par le bouton « Désactiver » de la ligne, et « Réactiver » rend le
  compte employé de la boutique. Ces boutons ne sont ni sur la ligne du
  gérant connecté ni sur celle du super admin, et le serveur refuse le geste
  à qui n'est pas gérant de la boutique.
- Les comptes désactivés sont en fin de liste, et ne comptent pas dans le
  nombre de membres de Mes boutiques.
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

#### Avec Discord

Le bouton « Se connecter avec Discord » apparaît sous le formulaire quand
l'app Discord est configurée (voir le README).

- Un compte Discord lié entre directement, puis revient sur la page demandée,
  comme avec le mot de passe. Un compte sans boutique où il est actif est refusé (« Ce
  compte n'a plus accès à aucune boutique. »).
- Un compte Discord lié à personne ne fait entrer personne. La page de
  connexion le dit (« Ton compte Discord X n'est encore lié à aucun
  membre… ») et propose d'entrer une fois avec l'identifiant et le mot de
  passe : ce compte-là est alors lié à ce Discord, pendant dix minutes. Sans
  compte, il faut un lien d'invitation (voir [Invitation](#invitation)). « Ce
  n'est pas mon compte Discord » l'oublie sans rien lier.
- Discord refusé ou en erreur, ou un retour qui ne vient pas de la demande
  faite par ce navigateur : « La connexion avec Discord n'a pas abouti.
  Réessaie. »

#### Lier Discord depuis Mon compte

- La page Mon compte (la clé, en haut à droite) a un bloc Discord :
  « Lier mon compte Discord » passe par Discord et revient lié ; une fois
  lié, elle montre le nom Discord et « Délier Discord ».
- Un compte ouvert avec Discord seul n'a pas de mot de passe : Mon compte lui
  propose « Choisir mon mot de passe » (sans mot de passe actuel), et ne lui
  laisse pas délier Discord avant, sinon plus rien n'ouvrirait le compte.
- Un compte Discord déjà lié à un autre membre est refusé (« Ce compte
  Discord est déjà lié à un autre membre. »).
- Lier ou délier Discord ferme les sessions ouvertes sur les autres
  appareils, pour de bon : délier, ou relier le même Discord, ne rouvre pas
  une session qu'une liaison avait fermée. Celle en cours reste ouverte. Le
  mot de passe marche toujours.
