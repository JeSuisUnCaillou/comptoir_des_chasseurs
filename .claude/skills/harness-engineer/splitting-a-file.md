# Scinder un fichier du harness

À lire à l'étape 6 quand une trouvaille de forme (`shape.py`, un `!`) nomme
un fichier, ici un `SKILL.md` ou `CLAUDE.md`. Une scission **déplace** des
sections sans réécrire leurs phrases ; ce qui est neuf, ce sont les
transitions et les pointeurs. Un fichier par passe sauf demande ; un commit
par fichier.

1. **Lis tout le fichier, et note pour chaque section** : sa responsabilité en
   une phrase, sa nature (étapes, référence, modèle, commandes, anecdote,
   garde-fou), ce qu'elle répète d'un autre fichier (`grep`, ligne citée), et
   son sort : *gardée*, *déplacée vers `<voisin>`*, *remplacée par un pointeur
   vers `<X>`*, *supprimée* (no-op, répétition de `<X:ligne>`, anecdote en
   trop dont la règle reste à `<ligne>`). Le sort suit
   `where-each-fact-goes.md` et le moment où la section est lue : ce que
   chaque exécution lit reste, ce qu'une étape lit devient un voisin, ce que
   deux skills font devient un skill.
2. **Crée les voisins en déplaçant des sections** : l'ancien texte, inchangé,
   sous un titre qui dit à quelle étape il est lu (« À lire à l'étape 4 ») et,
   au-delà de 100 lignes, un `## Sommaire`. Un voisin est lié depuis l'étape
   qui le nomme, par son chemin relatif, à un seul niveau.
3. **Réécris le fichier principal à partir de ses sections gardées**, dans
   l'ordre des étapes ; chaque étape finit sur ce qui dit qu'elle est faite et
   nomme le voisin ou le skill qu'elle appelle. La description passe sous 400
   caractères, les garde-fous sous cinq.
4. **Le registre** : `python3 .claude/skills/harness-engineer/scripts/shape.py --register <rev>:<chemin>`
   liste les paragraphes de l'ancien fichier qu'il ne trouve pas dans
   l'arbre. Chacun est une suppression, et le message de commit la justifie
   en une ligne : no-op, répétition, anecdote en trop, chiffre déplacé dans
   un audit. Un paragraphe absent à la fois de la justification du registre
   et du message est une règle perdue.
5. **Les contrôles** de `measures.md` § Contrôles, plus ce que le fichier a
   en propre : une ancre que `CLAUDE.md` ou le README lie suit dans le même
   commit.
6. **Rejoue l'échec** : pour chaque règle datée du fichier, rouvre l'audit
   qui l'a écrite et vérifie qu'à l'étape où le défaut est arrivé, le fichier
   qui la porte désormais aurait été lu. Une règle qu'aucun voisin ne fait
   lire au bon moment remonte dans le fichier principal.
7. **Dépose le contrôle d'impact** en issue `harness` : chaque voisin lu au
   moins une fois sur cinq exécutions à son étape (lu dans les sessions avec
   `list_events`, par les appels `Read` sur son chemin), avec la base, la date
   et le repli : **un voisin jamais lu remonte, sa section telle qu'elle
   était**.
