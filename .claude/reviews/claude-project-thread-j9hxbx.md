# Passe 1

Tête relue : f740f468b94e87c76edccc0b2568aca994e4f158

- Case citoyen restée cochée quand on change de marchandise (relecteur-bugs) : en partie confirmée. Quand plus aucune ligne n'a de prix citoyen, la case disparaissait mais revenait cochée ; corrigé en e9e3e9b avec un test vu rouge puis vert. Changer une ligne pour une autre marchandise à prix citoyen garde la case : c'est le même vendeur pour tout l'achat (README mis à jour en ce sens), rejeté.
- Confirmation tronquée au-delà de 25 lignes (relecteur-bugs) : confirmée, MAX_LINES = PAGE_SIZE en e9e3e9b.
- relecteur-architecte : aucune trouvaille.
- Trouvé en lançant la suite : « Peau d'ours » du nouveau test tombait dans la recherche « ours » du test du catalogue ; renommé en e9e3e9b.

# Passe 2

Tête relue : 65312d635922df42ef6e1da772f9bef7aa286bfa

- Aucune trouvaille (relecteur-bugs, relecteur-architecte).

Tête relue : 65312d635922df42ef6e1da772f9bef7aa286bfa
