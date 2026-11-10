# Passe 1

Tête relue : cf80b17

- relecteur-bugs : la case « Le vendeur est citoyen d'Estemarche » restait cochée quand on changeait de marchandise, et le montant passait au prix citoyen sans qu'on le redemande. Bloquant, corrigée en db0db40 (test vu rouge puis vert). La partie « après un envoi réussi » est rejetée : l'envoi redirige vers le registre, le formulaire est démonté.
- relecteur-architecte : aucune trouvaille. Le `name="citizen"` non lu par le serveur est rejeté : inoffensif, le serveur ne reçoit que le montant.

# Passe 2

Tête relue : db0db40

- relecteur-bugs : aucune trouvaille bloquante. Le calculateur des Tarifs et la liste de Gérer les tarifs n'affichent pas le prix citoyen : non bloquant, part en issue.
- relecteur-architecte : aucune trouvaille. Même remarque sur le calculateur.

Tête relue : db0db40f54bc02732d19f51d214f257f48b8c1e7

# Passe 3 (après la demande de Caillou de rendre le prix citoyen plus visible)

Tête relue : 026d213

- relecteur-bugs : aucune trouvaille bloquante. Une marchandise avec un prix citoyen mais sans prix de rachat ordinaire n'apparaît pas sur les Tarifs : rejeté, cas que le gérant n'a pas de raison de créer.
- relecteur-architecte : aucune trouvaille.

Tête relue : 026d2135ebec3bf3e65a73a6e030792242463eab
