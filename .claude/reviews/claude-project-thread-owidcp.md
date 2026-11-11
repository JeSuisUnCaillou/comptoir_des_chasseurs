# Passe 1

Tête relue : a9a4cee. Aucune trouvaille bloquante.

- relecteur-architecte : aucune trouvaille. Une sixième copie de `ALERT` suit un usage antérieur à la branche, laissée telle quelle.
- relecteur-bugs : aucune trouvaille. La garde serveur de `updateMember` (pas d'auto-rétrogradation) n'est atteignable que par une requête truquée, ce qu'un e2e ne sait pas envoyer.


# Passe 2

Tête relue : 08689fb (fusion de main, conflit résolu dans membres.spec.ts en gardant les deux jeux de tests).

- relecteur-bugs : le test du parchemin rechargeait la page sans attendre la réponse de l'action, donc il passait sans la garde. Corrigée en 1fa5bdc (vue rouge sans `canTakeDown`, verte avec).
- relecteur-bugs : le test d'auto-rétrogradation ne vérifie que l'interface. Déjà noté en passe 1 : la garde serveur n'est atteignable que par une requête truquée.
- relecteur-architecte : la passe 1 avait tort, la copie de `ALERT` dans caisse-en-attente.spec.ts est neuve. Corrigée en 1fa5bdc : `ALERT` est exporté par helpers.ts, et les six copies sont supprimées.

# Passe 3

Tête relue : 799cc6a. Les deux relecteurs n'ont rien trouvé.

Tête relue : 799cc6a04547c2bf48bce95db9757ab6b459e167

# Passe 4 (PR #122, refactor des couches, diff contre la branche de #115)

Tête relue : 9cada85.

- relecteur-bugs : aucun changement de comportement. `createStocked` lève maintenant un `UserError` là où il levait une `Error` simple, sur un cas impossible (quantité positive, marchandise neuve) : rejetée.
- relecteur-architecte : `readProductIdentity` lisait un `FormData` dans un service. Corrigée en 3deec10 (déplacée dans `lib/forms.ts`).
- relecteur-architecte : `membres/actions.ts` importait `memberRole` du schéma. Corrigée en 3deec10 (`readRole` dans `lib/forms.ts`), et la doc dit que le schéma sert partout pour ses types et ses énumérations.
- relecteur-architecte : la doc ne rangeait pas `auth/password.ts` ni `auth/return-path.ts`, et sa cellule « domaine pur » était confuse. Corrigée en 3deec10.
- relecteur-architecte : `recordMovement` refuse par `{ ok: false }` et non par `UserError`. Rejetée : la forme vient de `moveStock`, antérieure à la branche.
