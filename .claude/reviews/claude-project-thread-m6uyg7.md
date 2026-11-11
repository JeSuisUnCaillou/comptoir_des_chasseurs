# Passe 1

Tête relue : 6a18720

- architecte : la règle « une écriture = même auteur, type et instant » vivait dans la Server Action : corrigée en 6c52d78 (settleEntry dans lib/register.ts).
- architecte + bugs : `.citizen-price .badge` remplacé par erreur (badge des Tarifs passé de 12 à 11 px, `.row-actions` limité aux Tarifs) : corrigée en 6c52d78.
- bugs : Grand livre et page Mouvement de caisse non testés avec une ligne en attente : test ajouté en 6c52d78, vu rouge sans le filtre de `live()`.
- bugs : indentation des props de CancelButton : corrigée en 6c52d78.

# Passe 2

Tête relue : 6c52d78

- Aucune trouvaille bloquante. Écartés comme goût par les relecteurs : le filtre « En attente de la caisse » garde les lignes annulées (barrées), et la garde serveur de « Septims déposés » n'a pas de test propre (celle de l'annulation, identique, en a un).

Tête relue : 6c52d7857c9957c0db3b1892f0491d6237f45168

# Passe 3

Tête relue : 0aef7a7 (confirmations réduites à la question, demande de Caillou)

- Aucune trouvaille.

Tête relue : 0aef7a7ed221099a9c640ce6205bcb2fae86b557
