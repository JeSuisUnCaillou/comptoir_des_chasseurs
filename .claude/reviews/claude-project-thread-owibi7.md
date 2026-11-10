# Passe 1

Tête relue : 5972134

- relecteur-bugs : aucune trouvaille.
- relecteur-architecte : le filtre employé + dates (règle des dates, champs du formulaire, `registerAuthors`) était copié d'Achat/Vente dans l'Inventaire. Pas bloquant ; corrigée en 838863f (`dayRange` dans `lib/register.ts`, composant `MemberDateFilters`, `registerAuthors` renommé `memberNames`). Suite e2e verte (75 tests).

Aucune trouvaille bloquante : pas de nouvelle passe.

Tête relue : 838863f02195df9878116dea3541adf9718131ed
