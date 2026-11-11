# Passe 1

Tête relue : 1e934015a8d18a8feb29d4977ce73043015177ea

- Architecte : le critère « même écriture » était écrit deux fois (settleEntry et pendingEntryColumns). Non bloquant, corrigée en 1688d70 (pendingOfSameEntry partagé). Suite e2e verte (92).
- Architecte, remarque non retenue : un libellé avec retour à la ligne casserait la liste. Rejetée : les libellés viennent de champs d'une ligne (input), sans retour à la ligne.
- Bugs : aucune trouvaille.

Tête relue : 1688d70a568b65fff443f34c77eccba5aca492a3

# Passe 1 (PR #106, seed des previews)

Tête relue : 9c5da16168fa7493e12075bff98208f719ddd916

- Architecte : le SQL du seed refait recordTransaction/moveStock. Non bloquante (script de preview), corrigée en 2413c0f par un commentaire qui renvoie aux deux fonctions.
- Bugs : aucune trouvaille.

Tête relue : 2413c0f5cbd772373a97be7de57fd4538f230e15

# Passe 1 (PR #108, écritures en bloc)

Tête relue : 041cc8cd2b58f55497a7d73c637a075471569cc8

- Architecte : la définition d'une écriture était écrite deux fois (pendingOfSameEntry, entryKeyColumn). Non bloquante, corrigée en 1a1c1ce (entryOf partagé).
- Bugs : la page d'activité et le cas « ligne du haut annulée » n'étaient pas testés. Bloquante (changement sans test), corrigée en 1a1c1ce ; le test échoue sans place.settles dans activity-table, passe avec. Suite verte (93).

# Passe 2 (PR #108)

Tête relue : 1a1c1ce51712ca32c1ab06d3a4a4064e7f423bed

- Aucune trouvaille bloquante. Écartés : la petite fonction shared répétée dans les deux tables (goût), le libellé « pris » d'un achat non vérifié (même code que la vente).

Tête relue : 1a1c1ce51712ca32c1ab06d3a4a4064e7f423bed

# Passe 3 (PR #108, seed des écritures groupées)

Tête relue : 02b82e365c818644d0271b2c0daead5fc7c83085

- Architecte : commentaire de lib/entry-groups.ts encore sur l'ancien libellé du bouton. Non bloquant, corrigé en 1dfe81d.
- Bugs : aucune trouvaille. Écarté : le stock de la base de preview dérive à chaque nouveau lot d'exemples (voulu, dit au README).

Tête relue : 1dfe81d52babc809884ed30afb16bf8c1d39b0ce

# Passe 4 (PR #108, espace entre les blocs)

Tête relue : aecdcbe695d8e69ddda355df98c6e3f5751fcdec

- Aucune trouvaille bloquante. Écartés : libellé visible « N septims pris » d'un rachat non testé (même code que la vente, nom accessible testé), fonction shared répétée (goût).

Tête relue : aecdcbe695d8e69ddda355df98c6e3f5751fcdec
