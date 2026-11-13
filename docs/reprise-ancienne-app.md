# Reprendre les données de l'ancienne app

Deux scripts, lancés à la main depuis un poste qui joint l'ancienne app (le
cloud de Claude ne la joint pas). Il faut Node 22 et le dépôt cloné, avec
`npm install`. L'adresse, les identifiants et l'URL de la base sont demandés
au lancement, jamais lus dans l'environnement ni écrits dans le dépôt.

```bash
npm run legacy:export
npm run legacy:import -- legacy-export/ancienne-app-….json --cible=preview --essai
npm run legacy:import -- legacy-export/ancienne-app-….json --cible=preview
npm run legacy:import -- legacy-export/ancienne-app-….json --cible=prod --seulement=fournisseurs
```

Sous Windows dans Git Bash, lancer `winpty node scripts/legacy/export.mjs`
(et de même pour l'import) : sans `winpty`, le mot de passe s'affiche à la
frappe.

1. `legacy:export` (ou `node scripts/legacy/export.mjs <adresse> <identifiant>
   [<mot de passe>]`, qui demande ce qui manque ; un mot de passe passé ainsi
   reste dans l'historique du terminal) se connecte à l'ancienne app (certificat auto-signé
   accepté pour elle seule) et écrit tout ce que son API renvoie dans
   `legacy-export/` (ignoré par git) : stock, mouvements, tarifs des peaux,
   du cuir et des viandes, registre complet, trésorerie, fournisseurs,
   annonces. Prendre un compte de gérant, sinon des routes manquent.
2. `legacy:import` lit ce fichier et **remplace** dans la première boutique
   de la base cible (l'ancienne app n'était que le comptoir) les
   marchandises, l'historique du stock, le registre, les annonces et les
   fournisseurs, et met
   à jour le prix du cuir chez le forgeron. Les membres existants ne changent
   pas : chaque ligne est rattachée au membre du même identifiant ou du même
   nom. Un auteur de l'ancienne app sans compte en reçoit un à son nom, en
   employé et sans mot de passe (identifiant tiré du nom, sans accents ni
   espaces) ; le gérant lui en donne un depuis Membres.
   Les ajustements de trésorerie deviennent des mouvements de caisse
   « Ajustement de trésorerie » du registre. Un fournisseur désactivé dans
   l'ancienne app n'est pas repris ; ce qu'il vend est rattaché aux
   marchandises par leur nom.
   - `--seulement=fournisseurs` ne remplace que les fournisseurs et ce qu'ils
     vendent, rattaché aux marchandises déjà dans la base cible : le registre,
     le stock et les annonces ne bougent pas. C'est ainsi qu'on les reprend
     en prod après le premier import.
     Il vide tous les contacts avant : les clients saisis depuis (Roy…)
     disparaissent, et tout ce qui est repris redevient « il nous vend ».
   - `--cible=preview` ou `--cible=prod` est obligatoire ; on tape
     « écraser la preview » ou « écraser la prod » pour confirmer
     (`--cible=local`, pour le test, n'accepte qu'une base sur la machine).
   - `--base=<url>` donne l'URL de la base et `--oui` confirme sans la
     question, pour tout lancer en une ligne (l'URL reste alors dans
     l'historique du terminal).
   - `--essai` montre ce qui serait remplacé, la caisse obtenue et les
     avertissements, sans rien écrire.
   - Avant d'écrire, l'existant est sauvegardé dans `legacy-export/`, et tout
     s'écrit en une transaction : en cas d'erreur, la base ne bouge pas.

`npm run test:legacy` (lancé par la CI) joue les deux scripts contre une
fausse ancienne app et une base `comptoir_import_test`.
