# Passe 1

Tête relue : a9a4cee. Aucune trouvaille bloquante.

- relecteur-architecte : aucune trouvaille. Une sixième copie de `ALERT` suit un usage antérieur à la branche, laissée telle quelle.
- relecteur-bugs : aucune trouvaille. La garde serveur de `updateMember` (pas d'auto-rétrogradation) n'est atteignable que par une requête truquée, ce qu'un e2e ne sait pas envoyer.

Tête relue : a9a4cee8e43a7c6b5a6b0800b7046f7a738f08b9

# Passe 2

Tête relue : 08689fb (fusion de main, conflit résolu dans membres.spec.ts en gardant les deux jeux de tests).

- relecteur-bugs : le test du parchemin rechargeait la page sans attendre la réponse de l'action, donc il passait sans la garde. Corrigée en 1fa5bdc (vue rouge sans `canTakeDown`, verte avec).
- relecteur-bugs : le test d'auto-rétrogradation ne vérifie que l'interface. Déjà noté en passe 1 : la garde serveur n'est atteignable que par une requête truquée.
- relecteur-architecte : la passe 1 avait tort, la copie de `ALERT` dans caisse-en-attente.spec.ts est neuve. Corrigée en 1fa5bdc : `ALERT` est exporté par helpers.ts, et les six copies sont supprimées.
