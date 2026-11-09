# Où va chaque fait

À lire à l'étape 4 de la passe, et à l'étape 6 par `splitting-a-file.md`,
pour chaque mémoire comme pour chaque nouvelle règle. **Un fait a une place**,
celle qui est chargée quand on en a besoin ; tout autre endroit ne fait que
pointer vers elle.

| Le fait dit… | Il va dans | Exemples |
| --- | --- | --- |
| comment faire une chose, à une étape | le skill qui fait cette étape : son `SKILL.md` si chaque exécution le lit, un voisin si une seule étape le lit | « comment lire les sessions passées » → `harness-engineer/evidence.md` |
| un geste que font deux skills | un skill que les deux appellent avec `Skill(skill: "…")`, ou un agent de `.claude/agents/` que les deux lancent | les relecteurs, lancés par `revue-en-boucle` et `revue-architecture` |
| une convention pour tout travail sur le dépôt, quelle que soit la tâche | `CLAUDE.md`, et il en sort alors autant qu'il en entre | « chaque changement de comportement vient avec un test e2e », « jamais de tests contre la prod » |
| ce qu'un contrôle pourrait vérifier au lieu d'une phrase | un test dans `e2e/`, une étape de CI, `.claude/settings.json` : **proposé**, pas écrit, sauf un test e2e qu'une trouvaille demande | « les migrations correspondent au schéma » → déjà vérifié par `ci.yml` |
| ce dont le conteneur cloud a besoin au démarrage | le script de setup de l'environnement ou un hook SessionStart : **proposé dans le rapport**, le propriétaire le change dans les réglages de l'environnement | démarrer Postgres et créer la base de test avant la suite |
| une ligne des instructions du projet | `CLAUDE.md`, ou le skill dont elle régit l'étape ; un changement du texte des instructions est **proposé dans le rapport** | « suivre le travail dans les issues », « qui merge » |
| ce que le propriétaire attend de la conversation elle-même | `CLAUDE.md`, ou le skill dont elle régit l'étape | « répondre en français », « garder les réponses courtes sur le téléphone » |
| un fait du monde extérieur qui vieillit | le document qui possède son sujet, daté | les limites de l'offre gratuite de Supabase → `README.md` |
| un chiffre mesuré | l'audit qui l'a mesuré ; un skill pointe vers l'audit | coût par session, pushes par PR |
| une règle sur l'écriture du harness lui-même | `how-we-write.md`, puisque c'est le seul skill qui édite ces fichiers | « pas de seuil en pourcentage dans un skill » |

Deux tests tranchent vite :

- **Une session qui n'a jamais eu cette conversation pourrait-elle en avoir
  besoin ?** Si oui, une mémoire ne suffit pas : un sous-agent ne lit pas la
  mémoire, et une nouvelle session ne relit que l'index. C'est presque tout
  ce qui commence par « quand on livre », « quand on teste », « quand on
  ouvre une PR ».
- **Le fait est-il vrai dans un autre environnement ?** Sinon, il ne va dans
  aucun fichier versionné. Un chemin de conteneur, le chemin d'un dossier de
  mémoire, un id de session n'entrent pas dans un skill.

## Rapatrier une mémoire se fait en deux temps

Chaque fichier de mémoire, chaque ligne de `MEMORY.md` et chaque ligne des
instructions du projet finit la passe dans un fichier versionné, ou dans le
tableau de l'audit comme « déjà dans <fichier> ». Rien ne reste seulement en
mémoire ou seulement dans les instructions.

Deux temps, parce que la PR n'est pas mergée quand tu finis. Pendant la
passe, le fait entre dans le fichier versionné et la mémoire **garde son
contenu**, puisqu'une session ouverte demain lirait sinon un pointeur vers un
fichier que `main` n'a pas encore, mais reçoit cette ligne en tête :

```md
> **Version canonique** : `.claude/skills/<nom>/SKILL.md` dans le dépôt. Si les deux divergent, le dépôt gagne.
```

Après le merge, la mémoire est réduite à cette seule ligne et sa ligne quitte
`MEMORY.md`. Ton rapport les liste, et une issue `harness` aussi, que la
première passe après le merge exécute : un déplacement dont la seule trace est
une réponse n'arrive jamais. Une mémoire qui garde ce dont seule la
conversation a besoin (le « pourquoi » d'une préférence du propriétaire)
garde cette partie et perd le reste. Les instructions du projet appartiennent
au propriétaire : le rapport propose de réduire chaque ligne rapatriée à
« Lire CLAUDE.md d'abord ».
