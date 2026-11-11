# Passe 1

Tête relue : cf774ee0279f51335e4bd0c03a2e3a037b48e281

- relecteur-bugs : aucune trouvaille.
- relecteur-architecte : `canSettle` toujours vrai sur la page d'activité (la redirection garde déjà les employés). Rejetée, non bloquante : la condition dit sur place qui peut régler, et garde le bouton caché si la redirection est un jour assouplie ; la vraie garde reste `settleTransaction`.

Tête relue : cf774ee0279f51335e4bd0c03a2e3a037b48e281
