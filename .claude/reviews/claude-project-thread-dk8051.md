# Passe 1

Tête relue : 3ff5d15b7938496973db784b56f6dab733d4cee8 (relecteurs bugs et architecte).

- Aucune trouvaille bloquante.
- Relecteur bugs, mineur : une requête retenue par `holdRequests` reste en attente si une assertion échoue avant `release()`. Rejetée : sans conséquence, la page est fermée en fin de test.
- Relecteur bugs, mineur : le README ne mentionne pas le chargement. Rejetée : il ne décrit pas l'interface à ce niveau de détail.

Tête relue : 3ff5d15b7938496973db784b56f6dab733d4cee8
