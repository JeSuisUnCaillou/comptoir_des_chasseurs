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
