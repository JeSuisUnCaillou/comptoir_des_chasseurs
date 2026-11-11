# Passe 1

Tête relue : 9118e6f (relecteurs bugs et architecte).

- Architecte : arithmétique de dates (`shift`) recopiée dans la page, règle de période hors de `lib/register.ts`. Non bloquant, corrigée en 4c8524d (`lastDays` dans `lib/register.ts`).
- Bugs : un id démesuré dans `/membres/<id>` donne une erreur Postgres au lieu d'une page introuvable. Non bloquant (seul un gérant, par l'URL), corrigée en 4c8524d avec son test, vu rouge sans la garde.
- Bugs : pendant le build de prod, un mouvement écrit par l'ancien code après la migration a `transaction_id` nul et compterait deux fois. Rejetée : fenêtre de quelques minutes, sur une estimation.

Tête relue : 4c8524d22977ff1036415c20de0602aa04b4ca2f

# Passe 2

Tête relue : e4e5e16 (merge de main, #69), relecteurs bugs et architecte. Suite e2e verte (77).

- Aucune trouvaille ferme. Les deux relecteurs signalent un doute : les mouvements repris de l'ancienne app n'ont pas de `transaction_id` ; si l'export contient ceux des ventes, ils compteraient deux fois sur les périodes reprises. Non vérifiable sans les données de prod : laissé en issue (étape 8).

Tête relue : e4e5e16ac78507cd696525c92b5b9d24eb00ba64

# Passe 3 (PR #84 : quatre totaux, une seule liste)

Tête relue : 5f5ec0b, relecteurs bugs et architecte.

- Architecte : la requête de la liste unique était du SQL brut aux noms de tables et colonnes en dur, que tsc ne vérifie pas. Non bloquant, corrigée en 27914d5 : colonnes et tables prises dans `schema`.
- Architecte : badges d'opération écrits deux fois (registre et activité). Non bloquant, corrigée en 27914d5 : `components/operation-badge.tsx`.
- Bugs : le compteur « N opération(s) » compte les lignes annulées. Rejetée : elles sont dans la liste, barrées.
- Bugs : pas de test du message des marchandises sans prix de vente. Rejetée : comportement inchangé depuis #72, simple affichage.

Suite e2e verte (79) après correction.

Tête relue : 27914d5e2026a2dc5454893e77f86800f02d5c02
