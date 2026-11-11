# Passe 1

Tête relue : 25be980

- relecteur-architecte : appliedRate refait le choix du tarif déjà fait par buyTotal/sellTotal, le prix affiché pourrait diverger du montant. Confirmée, corrigée en c3d6a04 (buyTotal et sellTotal passent par appliedRate) ; suite e2e verte (89).
- relecteur-bugs : aucune trouvaille. Le montant de 100 pattes de vasard (17) vient bien du rachat 1/6 arrondi ; Caillou a confirmé que c'est bon.

# Passe 2

Correction mécanique (refactor sans changement de comportement, couverte par la suite) : pas de nouvelle passe nécessaire selon l'étape 5 (trouvaille non bloquante).

Tête relue : c3d6a04ba19a85db6aeb6ab6fe63ef7c36bc894c
