# Piloter la scène

À lire à l'étape 1. `scripts/stage.mjs` garde un navigateur ouvert par membre
entre les commandes, donc une semaine se joue un geste à la fois : agir,
regarder, décider.

## Les commandes

```sh
S=.claude/skills/tenir-le-comptoir/scripts/stage.mjs
node $S open --fresh --out <dir>      # en arrière-plan ; --phone (Pixel 7)
node $S do "await page.getByRole('link', { name: 'Inventaire' }).click()"
node $S do "await as('bjorn'); await page.goto('/connexion')"
node $S close
```

`open` sert cette copie avec `next start` sur le port de contrôle moins 6
(4174), arrêté par `close`, contre une base à elle : `comptoir_scene` sur le
Postgres local, ou `STAGE_DATABASE_URL`. Il faut un build à jour
(`npm run build`). `--fresh` recrée cette base et applique les migrations :
le comptoir s'ouvre pour la première fois, avec la grille de tarifs de
départ et aucun membre. Chaque `do` affiche ce que son code rend, ce que
l'app a écrit en console depuis la commande précédente, et la capture prise
après : **lis la capture**, ce sont tes yeux. Un geste impossible échoue au
bout de cinq secondes. Deux scènes jouent côte à côte quand chaque commande
de la seconde porte `STAGE_PORT=4190` (un port libre dont le numéro moins 6
est libre aussi), avec sa propre `--out` et sa propre `STAGE_DATABASE_URL`.

## Ce que `do` te donne

| Nom | Ce que c'est |
| --- | --- |
| `page`, `context` | ceux de Playwright, pour la fenêtre du membre en cours |
| `as(nom)` | passe à la fenêtre de ce membre, l'ouvre s'il le faut ; la scène s'ouvre sur `gerant` |
| `wait(secondes)` | le temps d'une scène de jeu entre deux visites |
| `note(texte)` | une ligne horodatée dans `<dir>/log.md` |

Chaque membre a son propre profil de navigateur dans `<dir>/profiles/<nom>`,
donc ses propres cookies : le gérant reste connecté pendant qu'un employé se
connecte dans sa fenêtre. `page.goto` prend un chemin (`/inventaire`).

## Où sont les choses à l'écran

Utilise ce que voit un membre : un lien du menu, le texte d'un bouton, le
libellé d'un champ (`page.getByRole('button', { name: 'Valider' })`,
`page.getByLabel('Quantité entrée')`). Les tests de `e2e/` montrent comment
chaque page se pilote ; lis-les pour savoir où cliquer, pas pour savoir ce
que l'app est censée faire, qui est dans le README.

## Les gestes d'une semaine

| Moment | Comment |
| --- | --- |
| un clic, une saisie | `page.getByRole(...).click()`, `page.getByLabel(...).fill(...)` |
| un autre membre au comptoir | `as('nom')`, puis il se connecte |
| le lendemain | `close`, puis `open` avec la même `--out`, sans `--fresh` |
| un autre appareil | `close`, puis `open --phone` avec la même `--out` |
| le wifi coupe | `context.setOffline(true)`, puis `false` |
| deux membres en même temps | un geste dans chaque fenêtre, sans recharger l'autre |

## Ce que la scène ne sait pas faire

- Elle joue la version de prod en local, pas la preview Vercel : ce qui ne
  se voit qu'avec Supabase ou Vercel (latence, pooler, variables) est dit,
  pas joué.
- Elle ne voit que Chromium.
- Le jeu lui-même n'est pas là : ce qui se passe dans Skyrim est imaginé dans
  le plan, et le temps entre deux visites est un `wait`.
