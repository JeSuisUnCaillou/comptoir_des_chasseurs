# Passe 1

Relue sur : 4f66686 (avant corrections)

- relecteur-bugs : la caisse n'était jamais vérifiée en chiffres, ni l'effet d'une annulation sur elle — test ajouté (« le filtre par dates et la caisse de la sélection, annulation comprise ») en 0a98225.
- relecteur-bugs : le filtre par dates du registre n'avait aucun test — même test, en 0a98225, avec la plage inversée.
- relecteur-bugs : pagination de l'historique, des cartes du stock et du catalogue (recherche, « Tout afficher », « Aucune marchandise ne correspond ») sans test — `e2e/pagination.spec.ts` en 0a98225. La pagination des membres n'a pas de test propre : même composant `Pagination` que le registre et l'historique, testés ; 26 comptes de plus pousseraient ceux des autres tests hors de la première page.
- relecteur-bugs : le refus serveur d'annuler la ligne d'un collègue n'est pas testé — rejetée : un test e2e ne peut l'atteindre que par l'interface, qui n'offre pas le bouton (testé) ; la garde serveur est lue dans `cancelTransaction`.
- relecteur-bugs et relecteur-architecte : le README disait « toutes les listes » paginées (faux pour Tarifs) et répétait 25 et 24 — corrigée en 0a98225, la phrase nomme les listes sans les tailles.
- relecteur-bugs : `.btn { white-space: nowrap }` touchait tous les boutons — corrigée en 0a98225, limitée à `.move-actions .btn`.
- relecteur-architecte (hors périmètre) : `recordTransaction` et `cancelTransaction` écrivent au registre depuis `app/` plutôt que `lib/` — précède la branche (renommage de dossier), non comptée.

# Passe 2

Relue sur : 157eb27

- relecteur-bugs : les fenêtres « Aujourd'hui » et « 7 derniers jours » du grand livre (`tillSummary`) n'étaient pas vérifiées en chiffres — test ajouté en 80c642f ; vu échouer avec la borne de semaine à -9 jours, puis passer à -6.
- relecteur-architecte : aucune trouvaille. Écartées par lui-même : la barre de pagination client des cartes du stock (mécanisme différent), et `revalidate()` qui liste les pages de formulaire — elles affichent le stock (« En stock : … »), la revalidation est utile.

# Passe 3

- relecteur-bugs : aucun test n'annulait un achat (retrait du stock, refus quand la marchandise est déjà vendue). Corrigé : test « annuler un achat retire la marchandise, sauf si elle est déjà vendue », vu échouer avec le sens du mouvement inversé.
- relecteur-architecte : `TransactionFields` n'avait qu'un appelant, `TransactionForm`. Corrigé : fusionnés.
- Suite e2e : 30 tests verts.

Tête relue : 4b0b2711f8fce536113f1e860c3e9a3ec7724815
