# Passe 1

Tête relue : 812d302

- Architecte : la règle « auteur ou gérant décroche » écrite deux fois (board et action) : corrigée en 9d2dc3c (`canTakeDown` dans `lib/announcement-rules.ts`). Non bloquant.
- Bugs : le changement de `e2e/registre.spec.ts` sort du périmètre : rejetée, la suite échouait à chaque fois avec les nouveaux tests (achat concurrent pendant les deux lectures) ; c'est expliqué dans la PR.
- Bugs : le test d'accueil pourrait perdre son parchemin si plus de 5 autres sont accrochés pendant ce temps : rejetée, la suite n'en accroche que 2 autres frais, le lot de pagination est daté d'hier.
- Bugs : le refus serveur d'un titre fait d'espaces n'est pas testé : corrigée en 9d2dc3c (nouveau test, vu échouer sans la vérification puis passer).

Aucune trouvaille bloquante : pas de deuxième passe.

# Passe 2

Tête relue : eb06677 (Annonces déplacée sous Marchandises, demandé par Caillou)

Aucune trouvaille.

Tête relue : eb0667730198b67b95ff51dcac317af837bfca4b
