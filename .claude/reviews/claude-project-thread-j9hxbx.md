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

# Passe 3

Tête relue : 3c17a8cd0f43554e3b60565a074fc71d49346ccf

- Limite de 25 marchandises sans test (relecteur-bugs) : confirmée ; le formulaire grise maintenant « Ajouter une marchandise » à 25 et un test e2e le vérifie, en 1b3e6a6.
- Écriture au registre et stock dans la Server Action plutôt que dans lib/ (relecteur-architecte) : rejetée pour cette PR, l'emplacement existait avant la branche et il n'y a qu'une entrée qui inscrit des ventes ; le relecteur la dit lui-même modeste.

# Passe 4

Tête relue : abee34c0b78d56fa6232fd96e8a6c504c67b3f41

- Limite de 25 marchandises absente du README (relecteur-bugs) : confirmée, non bloquante, corrigée en 8093d2f.
- Double ligne vide dans actions.ts (relecteur-architecte, écartée par lui) : retirée en 8093d2f.
- Rien de bloquant : la boucle s'arrête.

Tête relue : 8093d2ff7449b4bdae59ffd08300526e4af1418c

# Passe 5 (après le merge de main, conflit sur la prop highlight de RegisterTable)

Tête relue : 7740e65cefa241e55ab8bcc4a91fb7632d7307d0

- Aucune trouvaille bloquante. Écartés : un interblocage Postgres possible entre deux ventes multiples simultanées sur les mêmes marchandises en ordre inverse (une échoue sans rien écrire ; improbable à une dizaine de membres) ; la limite de 25 côté serveur sans test propre (inatteignable par le formulaire, que le test couvre).

Tête relue : 7740e65cefa241e55ab8bcc4a91fb7632d7307d0

# Passe 6 (total en doré)

Tête relue : 148756a434164af154c323f25e92a725eb1dd62f

- Aucune trouvaille.

Tête relue : 148756a434164af154c323f25e92a725eb1dd62f
