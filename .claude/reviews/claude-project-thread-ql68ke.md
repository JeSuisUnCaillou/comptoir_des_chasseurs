# Passe 1

Tête relue : 70f7233

- Seed de preview : sur une base neuve, la migration ne trouve aucun gérant, donc personne n'est super admin (bloquant pour l'essai) : corrigée en 9fa4ce9, Lomone devient super admin si personne ne l'est.
- Pas de test e2e de `createFirstGerant` qui donne le super admin : rejetée, le chemin demande une base sans membres alors que la suite tourne en parallèle sur une base partagée ; la contrainte et la garde serveur sont testées.

Architecte : aucune trouvaille.

Pas de nouvelle passe : la correction touche le seed seul (vérifié sur une base neuve : lomone super admin, aela non ; seconde exécution sans effet).
Tête relue : 9fa4ce9036376784c149d8f006b384a1e446a039

# Passe 2

Tête relue : 18a6d0a (la migration nomme `jesuisuncaillou`, à la demande de Caillou)

Aucune trouvaille chez les deux relecteurs. Ensuite, l'identifiant est comparé sans la casse dans la migration (12462d2), par prudence : vérifié sur une base à la 0009 avec un compte `jesuisuncaillou` employé, qui devient gérant et super admin.

Tête relue : 12462d2b94d1b2a89f7688f2e5e37a60efc731cd
