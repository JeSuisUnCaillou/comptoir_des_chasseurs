# Passe 1

Tête relue : f075a5b (relecteurs bugs et architecte).

- Bugs 1, l'export croit l'ancienne API plafonnée à 200 sans l'avoir vu : corrigée en d009d23 (plafond vu sur l'appel sans filtre, test avec un plafond de 100).
- Bugs 2, borne « to » peut-être exclusive dans l'ancienne API : corrigée en d009d23 (sondée sur une ligne connue, même test).
- Bugs 3, README muet sur --cible=local : corrigée en d009d23.
- Architecte, till() recopie la règle de caisse de lib/register.ts : rejetée, le script .mjs ne peut pas importer le TS, et il ne sert qu'à l'affichage de l'essai.
- Architecte, cancelled_by vide sur les lignes annulées importées : rejetée, register-table.tsx l'affiche « Annulée » et le motif passe en note.
- Architecte, couplage au schéma en SQL brut : rejetée, test:legacy tourne en CI sur une base migrée.

Pas de trouvaille bloquante restante : une passe suffit.

Tête relue : d009d23a1d5e8473219073d33fd69a836137fa71
