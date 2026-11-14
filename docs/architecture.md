# Architecture

Ce document dit où vit le code et dans quel sens vont les imports. C'est une
version adaptée de *layered-rails* (présentation, application, domaine,
infrastructure) pour Next.js et Drizzle, simplifiée pour une petite app. Lis-le
avant de placer du code. `npm run lint` (`scripts/check-layers.mjs`) vérifie
les règles marquées ✔.

## Les couches

| Couche | Fichiers | Ce qu'elle fait | Ce qu'elle ne fait pas |
| --- | --- | --- | --- |
| Présentation | `app/**/page.tsx`, `layout.tsx`, `components/` | Lit avec les requêtes de `lib/`, dessine, appelle les actions. | ✔ Pas de `drizzle-orm` ni de `@/lib/db`. Pas de règle métier : un calcul ou une décision de droits passe par `lib/`. |
| Actions | `app/**/actions.ts` (Server Actions), `app/**/route.ts` (retours OAuth de Discord) | Lit le formulaire (`lib/forms.ts`), vérifie la session et le rôle (`requireMember`), appelle **un** service de `lib/`, puis revalide et redirige. | ✔ Pas de SQL. Pas de règle métier au-delà de la forme des champs. |
| Services et requêtes | `lib/<domaine>.ts` marqué `import "server-only"` : `transactions.ts` (écrire le registre), `register.ts` (le lire, la caisse), `products.ts` (stock, catalogue), `categories.ts` (catégories de marchandises), `suppliers.ts`, `announcements.ts`, `members.ts`, `activity.ts`, `auth/session.ts`, `auth/discord.ts`, `shops.ts`, `invitations.ts`, `privileged-groups.ts` (clients privilégiés et leurs prix) | Un cas d'usage par fonction (« inscrire une vente », « annuler une ligne »), avec sa transaction. Reçoit la boutique (`shopId`, ou le membre qui la porte) et ne lit ou n'écrit que ses lignes. Refuse avec `UserError` (`lib/errors.ts`), que l'action rend au formulaire avec `attempt`. | ✔ Ne connaît ni `app/` ni `components/`. Pas de `FormData` : il reçoit des valeurs déjà lues. |
| Domaine pur | `pricing.ts`, `policies.ts`, `transaction-kinds.ts`, `announcement-rules.ts`, `entry-groups.ts`, `contact-kind.ts`, `transaction-draft.ts`, `pagination.ts`, `forms.ts`, `errors.ts`, `auth/password.ts`, `auth/return-path.ts`, `auth/key.ts`, `paths.ts`, `category-order.ts`, `game-count.ts` (lire les captures d'un coffre du jeu) | Calculs et règles sans base ni React : les prix, qui peut agir sur quoi (`isGerant`, `canActOn`), la lecture des formulaires, les mots de passe, les adresses. Sans état ni requête. | Pas d'accès à la base : un fichier qui lit la base est un service, il porte ✔ `server-only`. |
| Infrastructure | `lib/db/` (`index.ts`, `schema.ts`, `url.mjs`), `drizzle/` | Client Postgres, schéma, migrations, petits outils SQL (`byName`, `containing`, `isUniqueViolation`). | Pas de règle métier. |

Les imports descendent : présentation et actions → services → domaine pur et
infrastructure. Le schéma (`@/lib/db/schema`) peut servir partout pour ses
types et ses énumérations (`memberRole.enumValues`…), jamais pour une requête.
Un composant client qui n'est que de l'interface (`components/keep-values.ts`)
reste dans `components/`.

## La boutique visitée

Chaque page d'une boutique vit sous `app/[boutique]/`, à l'adresse
`/<slug>/…`. `proxy.ts` passe le chemin visité aux pages comme aux Server
Actions, et `currentShop()` (`lib/shops.ts`) en tire la boutique ; le membre
de `requireMember()` la porte (`member.shopId`, `member.shop.slug`). Une
adresse se construit avec `shopPath(slug, "/inventaire")` (`lib/paths.ts`),
dans un composant client avec `useShopPath()` ; jamais à la main. Après une
écriture, l'action appelle `revalidateShop()` (`app/[boutique]/revalidate.ts`).

Les pages hors boutique (`/`, `/boutiques`, `/invitation/<jeton>`,
`/connexion`) sont directement sous `app/` ; leur premier segment est dans
`RESERVED_SLUGS` (`lib/paths.ts`), qu'une nouvelle page hors boutique doit
rejoindre pour qu'aucune boutique ne prenne son adresse. Elles demandent le
compte avec `requireAccount()` plutôt que `requireMember()`.

## Où mettre quoi

- **Une nouvelle écriture en base** : une fonction dans le service de son
  domaine, appelée par une action. La transaction et la vérification que
  l'objet appartient à la boutique sont dans le service.
- **Une nouvelle lecture** pour une page : une requête dans le module de son
  domaine. La page l'appelle avec `member.shopId`.
- **Une règle de droits** (« gérant ou auteur ») : `lib/policies.ts`. La page
  s'en sert pour montrer un bouton, et le service s'en sert pour refuser. Les
  deux doivent la lire au même endroit.
- **Un calcul** (prix, total, caisse) : le domaine pur s'il ne lit rien en
  base, sinon le service qui lit les données.
- **Un champ de formulaire** : `lib/forms.ts` (`text`, `optionalText`,
  `optionalInt`, `optionalId`, `checked`).

Une règle écrite deux fois, ou du SQL ajouté dans `app/`, est une trouvaille
pour le relecteur `relecteur-architecte`.
