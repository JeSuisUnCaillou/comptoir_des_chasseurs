# Passe 1

Tête relue : cfcd07d

- Bugs : les groupes du choix d'Achat/Vente suivaient l'ordre d'apparition des catégories, donc le premier nom de l'alphabet ; corrigée en aa2b91d (ordre de `CATEGORY_LABELS`, test vu rouge sans la correction).
- Architecte : aucune trouvaille. Réserve non vérifiée sur la collation `fr-x-icu` chez Supabase : la preview de la PR, sur sa base Supabase, la vérifie.

# Passe 2

Tête relue : aa2b91d

- Bugs : aucun test ne visitait /tarifs, où la section des ressources mêle deux catégories ; test ajouté en 87e61cb, vu rouge avec l'ancien tri par catégorie.
- Architecte : aucune trouvaille.

Rien de bloquant : la boucle s'arrête. Laissé au propriétaire : rien.

Tête relue : 87e61cb17f8c1b10a6138c1d8a9038d007a8bfb0
