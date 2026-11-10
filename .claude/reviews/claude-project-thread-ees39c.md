# Passe 1

Tête relue : 58aa668

- relecteur-bugs : le champ de LiveSearch gardait l'ancienne recherche quand l'adresse changeait ailleurs (menu Tarifs, retour arrière). Bloquant, corrigée en 4722613 avec un test vu rouge puis vert.
- relecteur-architecte : rien.

# Passe 2

Tête relue : 4722613

- relecteur-bugs : rien.
- relecteur-architecte : rien de bloquant. Calcul de `q` répété sur trois pages et filtre JS sur Tarifs contre `ilike` sur Gérer les tarifs : rejetées, mineures et sans effet pour les noms du comptoir.

Tête relue : 47226139296d2308606f803edcbf9efa85161dba
