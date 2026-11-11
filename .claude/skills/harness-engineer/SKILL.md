---
name: harness-engineer
description: Améliore le harness du comptoir (CLAUDE.md, skills, agents, hook, mémoire d'équipe) à partir de ce qui s'est passé dans les fils du projet, et programme un contrôle de chaque changement. Écrit un audit, l'applique, ouvre la PR. Déclencheurs : « harness-engineer », « améliore le harness », « sanity check du harness ».
---

# harness-engineer

Le harness, c'est ce qu'un agent lit avant d'agir et ce qui le corrige après.
Quand un agent fait deux fois la même erreur, c'est le harness qui a un
défaut. Tu relis ce qui a fait écrire le code, pas le code ; un bug de l'app
va dans sa propre issue.

## Où ça tourne

Le travail se fait dans un **projet Claude** : le propriétaire parle au
coordinateur dans le chat du projet, et chaque travail a son fil, mené par
une session cloud jetable. Seul survit ce qui est poussé, mis en issue ou en
mémoire d'équipe. Le propriétaire lit sur son téléphone : la PR doit se juger
ligne par ligne, la réponse dans le fil reste courte.

| Pièce | Lue quand |
| --- | --- |
| `CLAUDE.md` | chaque session, en entier : chaque ligne coûte à chaque tour |
| `.claude/skills/*/SKILL.md` | quand le skill est invoqué, seulement |
| `.claude/agents/*.md` | quand un skill lance l'agent |
| `.claude/settings.json`, `.claude/hooks/` | exécutés par le harness lui-même |
| mémoire d'équipe (`MEMORY.md` + fichiers) | l'index à chaque session |
| `e2e/`, `.github/workflows/` | à chaque PR |

## La passe

1. **Fenêtre** : depuis le plus récent `.claude/audits/*-harness*.md` sur
   `origin/main`. Trouve ou ouvre l'issue « Passe du harness AAAA-MM-JJ »,
   étiquetée `harness`. Les issues `harness` « Contrôle : … » échues : mesure,
   écris *tenu* / *pas tenu* / *pas mesurable* dessus, ferme ce qui tient.
2. **Preuves**, notées avec leur source avant de les interpréter :
   - le chat du projet (`read_project_chat`) et les fils (`list_threads`,
     `read_thread`) : ce que le propriétaire a tapé. Cherche d'abord ses
     **corrections** (« non », « je t'ai dit », une consigne répétée), puis
     les questions dont la réponse était écrite, les tours finis sur une
     attente, les mêmes erreurs d'outil répétées ;
   - GitHub : les PR de la fenêtre (pushes après ouverture, CI rouge puis
     verte), les issues ;
   - la mémoire d'équipe : chaque ligne qui porte une règle absente du dépôt,
     ou un fait devenu faux.
3. **Diagnostique** chaque défaut avec trois questions. *Contexte* : l'agent
   avait-il la bonne chose sous les yeux au bon moment ? (déplacer,
   raccourcir, rarement écrire plus). *Contraintes* : une règle enfreinte
   deux fois malgré sa prose demande un contrôle (hook, test, check CI), pas
   une phrase de plus. *Entropie* : qu'est-ce qui a cessé d'être vrai ?
   (corriger, supprimer). **Une nouvelle règle demande deux occurrences**, ou
   une seule qui a coûté une PR, ou une demande explicite du propriétaire.
   Préfère toujours retirer à ajouter.
4. **Écris l'audit** `.claude/audits/AAAA-MM-JJ-harness.md` en premier
   commit : la fenêtre et les sources lues, puis par trouvaille le défaut, la
   preuve, le remède, et l'impact attendu (mesure, base datée, seuil, date de
   contrôle, repli). Ce que tu n'as pas pu lire, dis-le.
5. **Applique**, un commit par trouvaille. Sans demander : l'entropie, les
   coupes, et les règles de la mémoire que le dépôt ne porte pas encore.
   Proposé dans la PR, pas mergé sans le propriétaire : retirer une règle ou
   un skill, toucher `.claude/settings.json` ou un hook.
6. **Vérifie** chaque commande écrite ou changée, condition vraie et fausse ;
   la suite e2e si `e2e/` a bougé. Pousse, ouvre la PR (`Closes #n`), une
   ligne par trouvaille avec sa preuve. Puis `revue-en-boucle`.
7. **Après le merge** : allège la mémoire d'équipe de ce qui est maintenant
   dans le dépôt (un renvoi d'une ligne), et ouvre une issue `harness`
   « Contrôle : <sujet> » par trouvaille appliquée, à une semaine.

## Garde-fous

- Aucune trouvaille sans preuve rassemblée dans cette passe.
- Tu écris sous `.claude/`, dans `CLAUDE.md` et en mémoire ; pas dans l'app
  ni le README.
- La mémoire ne se vide qu'après le merge, quand son contenu est sur `main`.
- Lis les fils par pages ; ne garde dans ton contexte que les preuves.
