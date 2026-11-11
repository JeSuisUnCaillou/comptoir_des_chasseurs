---
name: recherche-ux
description: Joue une semaine du comptoir comme plusieurs membres (gérants, employés) dans la vraie app, note ce qui gêne, en tire les besoins et ouvre une issue par besoin ; ne change aucun code. Déclencheurs : « recherche-ux », « UX research », « parcours l'app comme un membre », « teste l'app par scénarios ».
---

# recherche-ux

En jeu, le comptoir a deux coffres : un de marchandises, un de septims.
L'app doit dire ce qu'il y a dedans, qui y a touché et pourquoi. Tu joues
plusieurs membres pendant une semaine, avec l'app à côté du jeu, et chaque
hésitation, mauvais compte ou écart entre les coffres et l'app est une
trouvaille. Puis tu fais ce que fait un chercheur UX : tu sépares ce qui a
été vu de ce qu'on voudrait, tu regroupes par besoin, et tu rends au
propriétaire quelques besoins à trancher plutôt qu'une pile de tickets.

## 1. Monter la scène

La session ne joint pas `*.vercel.app` : la scène est un build de la branche
(sinon `main`) lancé dans la session, avec les données d'une preview.

- Postgres comme dans `CLAUDE.md` § Tests de bout en bout, mais une base
  `comptoir_ux` (pas `test` : la suite e2e la viderait). `.env.local` avec
  `DATABASE_URL` et `AUTH_SECRET`, puis `npm run db:migrate`.
- `VERCEL_ENV=preview node scripts/seed-preview.mjs` : les données de la
  preview (Lomone, Aela, stock, écritures). Donne aux comptes du seed un mot
  de passe connu par un petit script qui écrit `members.password_hash` au
  format de `lib/auth/password.ts`. C'est le seul accès direct à la base.
- `npm run build`, puis `npm start` en arrière-plan.
- Tu pilotes avec Playwright (`require('playwright')`), un script par scène
  dans ton scratchpad, une capture après chaque geste, que tu regardes. Un
  gérant qui fait ses comptes est sur ordinateur ; un employé en jeu consulte
  souvent l'app sur son téléphone (`devices['iPhone 13']`).

## 2. Écrire la semaine

Dans `<dir>/log.md` (`<dir>` = `/mnt/project-files/recherche-ux/<date>/`) :
les membres joués (au moins trois, de sortes différentes : le gérant, un
employé rodé, un nouveau qu'on forme), les jours, les visites, et **le
contenu des deux coffres** au départ. Tu tiens les coffres à jour toi-même à
chaque geste : c'est la vérité du jeu, à laquelle l'app sera comparée.

Ce qui arrive dans une semaine : une vente, un achat à un chasseur (citoyen
d'Estemarche ou non), du stock qui entre sans achat (chasse du gérant, don),
le loyer, un prêt qu'on rembourse, les salaires, la compta du dimanche, et
repartir propre la semaine suivante (caisse et stock comptés, l'app alignée
sur les coffres). Ce qui tourne mal : une quantité tapée de travers, des
septims pas encore déposés, une marchandise inconnue, un prix qui change, un
employé qui se trompe d'article, deux membres au comptoir en même temps, un
coffre qui ne tombe pas juste. Invente mieux que cette liste.

## 3. Jouer

Déroule la semaine visite par visite, en changeant de membre (gérant crée les
comptes des employés par la page Membres). Après chaque geste : ce que tu
attendais, ce qui s'est passé, la capture. Fin de semaine : compare coffres
et app, ligne par ligne. Reste derrière le comptoir : le README est le mode
d'emploi que tu aurais lu ; pas de lecture de `app/` ni `lib/`, pas de SQL.

## 4. Des observations aux besoins

- **Observation** : une chose vue, avec sa preuve (capture, étapes) et le
  membre ; ce qu'il aurait voulu va sur une ligne à part. Ce qui marche bien
  est une observation aussi : un changement doit le garder.
- **Besoin** : regroupe par moment de la semaine et par ce que le membre
  essayait d'accomplir, jamais par page. Écris-le en job story (« Quand …, je
  veux …, pour que … ») et demande pourquoi jusqu'à ce qu'il parle du
  comptoir, sans nommer de bouton.
- **Poids** : confiance (vu par un membre = piste ; deux = moyenne ; trois de
  sortes différentes = haute) et coût de 1 à 4 (4 : les comptes sont faux ou
  la caisse se perd ; 3 : un gérant perd une soirée ; 2 : contourné à chaque
  fois ; 1 : cosmétique), avec une ligne de pourquoi.
- Un besoin qu'une règle du README empêche est une question pour le
  propriétaire, qui cite la règle.

## 5. Rendre

- `<dir>/rapport.md` : la semaine en cinq lignes, les besoins par coût (job
  story, pourquoi l'app le sert mal, confiance, observations, deux ou trois
  directions, pas un design), ce qui marche et doit rester, puis toutes les
  observations. Les captures citées sont dans `<dir>`.
- Une issue par besoin qui vaut une décision, étiquetée `ux`, après avoir
  cherché les issues ouvertes qui le couvrent déjà (celle-là reçoit plutôt un
  commentaire). Un bug (l'app fait autre chose que le README, ou compte faux)
  a sa propre issue `bug`, avec les étapes.
- Dans le fil : les besoins dans l'ordre, les issues, ce que le propriétaire
  doit trancher, et le rapport joint.

**Ne change aucun code ni doc** : le propriétaire choisit ce que deviennent
les besoins.
