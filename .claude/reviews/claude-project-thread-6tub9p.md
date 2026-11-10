# Passe 1

Tête relue : b77d452

- Bugs : le test e2e ne vérifiait pas que la caisse compte un mouvement ni qu'elle l'oublie à l'annulation (bloquant, test manquant). Corrigée en 63e2f9e : le test lit la caisse filtrée « Mouvements de caisse » avant, après, et après l'annulation ; vu rouge en ajoutant les sorties au lieu de les retirer.
- Architecte : le sens des sortes (entrée = +, sortie = −) et le test « mouvement de caisse » étaient écrits en plusieurs endroits. Corrigée en 63e2f9e : `lib/transaction-kinds.ts` (`CASH_KINDS`, `isCashKind`, `signedAmount`), utilisé par le registre, la notice, le filtre et l'aperçu. La caisse SQL garde ses sommes par sorte.
- Architecte : l'insert de `recordCashMovement` hors de `lib/`. Rejetée : `recordTransaction` écrit déjà depuis `actions.ts`, c'est la convention actuelle ; `lib/register.ts` ne fait que lire.
- Architecte : « Ligne annulée, stock rétabli. » après l'annulation d'un mouvement. Rejetée : `CancelButton` n'affiche le message que si `ok` est faux, ce texte n'est jamais vu.

# Passe 2

Tête relue : 63e2f9e

- Aucune trouvaille bloquante. Un montant au-delà de 2³¹ échoue à l'insert : défaut déjà présent dans `recordTransaction`, montant absurde au comptoir, écarté.

Restes : la conversion des ajustements importés en mouvements de caisse part dans sa propre issue (seconde PR, après le merge).

Tête relue : 63e2f9e1f23cf5ac1cac34b25575666b5783c19b
