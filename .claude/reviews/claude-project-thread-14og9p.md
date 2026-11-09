# Passe 1

Tête relue : f075a5b (relecteurs bugs et architecte).

- Bugs 1, l'export croit l'ancienne API plafonnée à 200 sans l'avoir vu : corrigée en d009d23 (plafond vu sur l'appel sans filtre, test avec un plafond de 100).
- Bugs 2, borne « to » peut-être exclusive dans l'ancienne API : corrigée en d009d23 (sondée sur une ligne connue, même test).
- Bugs 3, README muet sur --cible=local : corrigée en d009d23.
- Architecte, till() recopie la règle de caisse de lib/register.ts : rejetée, le script .mjs ne peut pas importer le TS, et il ne sert qu'à l'affichage de l'essai.
- Architecte, cancelled_by vide sur les lignes annulées importées : rejetée, register-table.tsx l'affiche « Annulée » et le motif passe en note.
- Architecte, couplage au schéma en SQL brut : rejetée, test:legacy tourne en CI sur une base migrée.

Pas de trouvaille bloquante restante : une passe suffit.

# Passe 2

Tête relue : 6bdba3a (branche rebasée sur main, import des annonces ajouté).

- Architecte, README § CI muet sur test:legacy : corrigée en e45ad32.
- Bugs, un format inattendu du tableau donnerait 0 annonce : rejetée, l'essai l'affiche avant toute confirmation.

Rien de bloquant.

Tête relue : e45ad324adb27f58a9efca397d39cd6f84106e8d
