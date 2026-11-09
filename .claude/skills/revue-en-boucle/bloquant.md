# Bloquant ou non

À lire à l'étape 2, avant de classer la première trouvaille d'une passe. Tu
décides, sur le code que la trouvaille cite. Trop large et la boucle tourne
pour le confort, trop étroit et un bug part en prod ; dans le vrai doute, pas
bloquant. Toute trouvaille confirmée est corrigée ; seule une bloquante force
une nouvelle passe.

**Bloquant**, seulement dans le code (`app/`, `components/`, `lib/`,
`drizzle/`, `scripts/`, `e2e/`, `.github/`, `.claude/hooks/`) :

- un bug qu'un membre du comptoir ou une session rencontrerait ;
- un compte faux : stock, prix, vente, rachat, registre ;
- un accès qu'un rôle ne devrait pas avoir, un secret dans le dépôt ;
- une migration incompatible avec le code en prod pendant le build
  (`CLAUDE.md` § Base de données) ;
- un changement de comportement sans test de bout en bout qui échoue sans
  lui ;
- tout ce qui ferait passer la CI au rouge.

**Pas bloquant**, tout le reste, y compris du code au mauvais endroit ou un
import contre le sens que le relecteur architecte décrit, sauf si c'est aussi
un bug : ça mesure une dette, pas un risque au comptoir, et bloquer dessus
ferait tourner la boucle sur du design. Corrige-le quand même. Aussi toute
erreur de texte (un commentaire, un doc, un skill, même une affirmation
fausse), un fait écrit deux fois, un manque dans un doc, le style, les noms,
la structure.

**La correction la plus mécanique gagne** : supprimer plutôt que reformuler,
renvoyer au fichier qui possède un fait plutôt que le répéter. Chaque ligne
écrite pour répondre à une trouvaille est une chance de plus d'une trouvaille
à la passe suivante. Une correction qui affirme un fait extérieur (le
comportement de Next.js, le contrat d'une API) se vérifie à la source en
l'écrivant.
