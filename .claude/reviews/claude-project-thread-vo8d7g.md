# Passe 1

Tête relue : 7a92d28

- relecteur-bugs : les 26 comptes « Abel… » du test de pagination prenaient toute la page 1 de /membres et repoussaient les membres des autres tests (sariel, intrus, einar) en page 2. Corrigée en e0548a4 : comptes nommés « Zz … », triés après tous les autres ; le dernier est cherché en suivant les pages jusqu'au bout.
- relecteur-architecte : aucune trouvaille.

# Passe 2

Tête relue : e0548a4

- relecteur-bugs : aucune trouvaille.
- relecteur-architecte : aucune trouvaille.
- Vérifié : le test du refus d'annulation passe au rouge sans la garde de `cancelTransaction`, au vert avec.

Tête relue : e0548a418a3c4704dc752b9782d7722b10ca1f28
