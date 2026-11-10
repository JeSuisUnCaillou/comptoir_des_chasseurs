# Passe 1

Tête relue : 58aa668

- relecteur-bugs : le champ de LiveSearch gardait l'ancienne recherche quand l'adresse changeait ailleurs (menu Tarifs, retour arrière). Bloquant, corrigée en 4722613 avec un test vu rouge puis vert.
- relecteur-architecte : rien.

# Passe 2

Tête relue : 4722613

- relecteur-bugs : rien.
- relecteur-architecte : rien de bloquant. Calcul de `q` répété sur trois pages et filtre JS sur Tarifs contre `ilike` sur Gérer les tarifs : rejetées, mineures et sans effet pour les noms du comptoir.

# Passe 3

Tête relue : 755e71c (barre élargie, libellé « Chercher une marchandise »)

- relecteur-bugs : rien.
- relecteur-architecte : rien.

# Passe 4

Tête relue : c2961ee (cuir et calculateur en tête, recherche du calculateur, resynchronisation du champ revue après un test instable, fusion de main avec #39)

- relecteur-bugs : rien.
- relecteur-architecte : rien. Le filtre JS du calculateur relève de la famille déjà rejetée en passe 2.

# Passe 5

Tête relue : 8f5f589 (combobox du calculateur)

- relecteur-bugs : le README disait que le calculateur propose « toutes les marchandises », alors qu'il ne reçoit que celles qui ont un prix. Doc seulement, corrigée en 1706232.
- relecteur-architecte : rien.

Tête relue : 1706232552af301b2fd8c30b5613e7b54f4a45ec
