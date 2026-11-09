# Comment on écrit dans le harness

À lire à l'étape 2 pour ses seuils, et à l'étape 6 avant d'écrire une ligne
dans un skill, un agent ou `CLAUDE.md`. Ces fichiers sont lus par des gens et
par des agents qui n'ont pas le contexte où ils ont été écrits.

## Sommaire

- La forme d'un skill
- Les seuils, et ce qu'ils protègent
- Ce que le dépôt fixe déjà
- Écrire pour un téléphone
- `CLAUDE.md`

## La forme d'un skill

Ce que [`writing-for-agents`](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md)
et [le guide d'Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
nomment, appliqué ici :

- **`SKILL.md` porte ce que chaque exécution lit, et rien d'autre** : le rôle
  en quelques lignes, les étapes dans l'ordre, chacune finissant sur ce qui
  dit qu'elle est faite, au plus cinq garde-fous.
- **La référence va dans un fichier voisin, lu à l'étape qui en a besoin**,
  nommé à cette étape par son chemin relatif, dans `.claude/skills/<nom>/`.
  **Un seul niveau** : un voisin ne lie pas un autre voisin, puisqu'un lien de
  second niveau tend à être lu partiellement. Un voisin de plus de 100 lignes
  s'ouvre sur `## Sommaire`.
- **Un geste que font deux skills est un skill que les deux appellent**, avec
  `Skill(skill: "…")` écrit à l'étape : nommer l'outil obtient l'appel, un
  `/nom` dans la prose non
  ([invocation.md](https://github.com/mattpocock/skills/blob/main/.agents/invocation.md)).
  Un nouveau skill se paie d'une description chargée à chaque tour : n'en crée
  un qu'avec deux appelants au dossier. **Un sous-agent que deux skills
  lancent est un agent** de `.claude/agents/`, avec sa consigne, ses outils et
  son modèle ; le skill ne lui passe que ce qui change d'un appel à l'autre.
- **La description est un pointeur, pas un résumé** : ce que fait le skill en
  une phrase, puis ses déclencheurs. Le contrat est dans le corps, chargé à
  l'invocation seulement.
- **Garde l'invocation par le modèle.** Dans ce projet, le propriétaire
  demande le travail dans le chat du projet et une session de fil le fait ;
  un skill marqué `disable-model-invocation: true` ne peut être lancé que par
  un `/nom` tapé dans la session elle-même, qu'une session de fil ne reçoit
  jamais. Garde plutôt la description courte.
- **Une anecdote par règle, la plus parlante, datée, avec ce qu'elle a
  coûté** : « vu le 2026-11-09 dans la PR #4 » vaut mieux qu'un adverbe. Les
  audits gardent le reste. Une anecdote dont le défaut a été corrigé sort.
- **Un chiffre vit dans l'audit qui l'a mesuré.** Un skill qui a besoin d'un
  ordre de grandeur pointe vers l'audit ; un chiffre copié devient une règle
  fausse. Pas de seuil en pourcentage : un seuil se lit sur la valeur que
  l'outil rend.
- **Pas de no-op** : une règle que le modèle suit déjà par défaut paie sa
  ligne pour rien ; **pas de négation d'un positif déjà écrit**, « ne fais pas
  X » rend X plus présent. Un garde-fou pare un geste que le modèle fait
  volontiers et qu'aucune règle positive ne couvre.

## Les seuils, et ce qu'ils protègent

`scripts/shape.py` les applique ; un `!` est une trouvaille.

| Seuil | Valeur | Ce qu'il protège |
| --- | --- | --- |
| lignes d'un `SKILL.md` | 150 (jamais plus de 200) | qu'une règle à l'étape 9 pèse autant qu'à l'étape 1 |
| caractères d'une description | 400 (la limite documentée est 1 024) | chaque tour de chaque session, où toutes sont chargées |
| garde-fous | 5 | qu'ils restent lus |
| sommaire d'un voisin | dès 100 lignes | qu'une lecture partielle voie tout ce qu'il contient |
| paragraphes en double (`--duplicates`) | 0 | qu'un fait ait une place |

## Ce que le dépôt fixe déjà

- **La langue** : le harness, les docs, les commits, les PR et les issues en
  français ; le code en anglais (`CLAUDE.md` § Langue).
- **Prose coupée à 80 colonnes**, comme dans le README et `CLAUDE.md`.
- **Des mots simples.** Dire la chose plutôt que son image : « une vente
  enregistrée au registre », pas « une écriture transactionnelle ».
- **Un titre dit ce qui doit être vrai**, pas ce qui est interdit ; les gestes
  interdits ont leur section, « Garde-fous », et celle-là seulement.
- **Une règle abstraite liste ses cas.** « Chaque fois qu'un lecteur pourrait
  en faire plus » ne se lit pas ; « le cas symétrique d'une règle, le reste
  d'une section, les champs optionnels d'un format » se lit.
- **Rien de personnel ni d'environnemental dans un fichier versionné** : pas
  de chemin de conteneur, pas de chemin de dossier de mémoire, pas d'id de
  session, pas de jeton ni de secret. Ce qu'un skill attend de
  l'environnement, il le nomme ou le déduit.
- **Une information, une place.** Un fait que deux fichiers doivent mentionner
  : l'un le porte, l'autre y renvoie en une ligne.

## Écrire pour un téléphone

Le propriétaire relit dans l'app mobile et sur le site mobile de GitHub.

- **Une description de PR se suffit** : une ligne par trouvaille avec sa
  preuve et son commit, pour la juger sans ouvrir un fichier.
- **Une réponse dans le fil tient sur un écran.** Le détail est dans l'audit ;
  la réponse renvoie à la PR.
- **Les tableaux restent étroits** : trois colonnes au plus dans ce que le
  propriétaire lit (les tableaux de l'audit sont pour la passe suivante, pas
  pour le téléphone).
- **Un choix pour le propriétaire est une question avec des options courtes**,
  à laquelle on répond d'un tap ou d'un mot.

## `CLAUDE.md`

**`CLAUDE.md` est lu en entier à chaque tour.**
[HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
conseille moins de 300 lignes, et le nôtre est loin en dessous : garde-le
ainsi. Y ajouter, c'est en retirer autant, ou pointer vers un skill qui ne se
charge qu'à l'invocation.
