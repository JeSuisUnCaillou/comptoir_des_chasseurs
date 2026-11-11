# Harness — simplification du 2026-11-11

Passe sur demande. Le propriétaire, chat du projet, 2026-11-11 22:08 : « ces
deux repos c'était mes premiers essais de harness engineering […] Tu peux
simplifier les process immensément je pense. Et tu évolues pas dans le même
environnement […] Tu es dans claude desktop, alors que ces repo ont été faits
dans claude code ». Le harness avait été porté de soundboard (PR #6).
Précédent : [2026-11-11-harness.md](2026-11-11-harness.md).

## Mesures
| | Avant | Après |
| --- | --- | --- |
| lignes du harness (`CLAUDE.md` + `.claude/` hors audits et revues) | 2 163 | 523 |
| skills | 5 | 3 |
| fichiers de revue commités sur `main` (`.claude/reviews/`) | 39 | 0 |
| `harness-engineer` (SKILL + fichiers voisins + script) | 878 lignes, 9 fichiers | 1 fichier |

## Trouvailles

### 1. `harness-engineer` est écrit pour Claude Code, pas pour un projet Claude
**Pilier** : entropie. **Preuve** : `evidence.md` lisait les sessions par
`list_sessions` / `list_events` ; ici le côté du propriétaire est dans le
chat du projet et les fils (`read_project_chat`, `read_thread`), lus tels
quels pour la passe du jour. Huit fichiers voisins et `shape.py` (878 lignes)
pour une méthode qui tient en une page. **Remède** : fusionner en un seul
`SKILL.md` qui part des fils du projet.
**Impact attendu** : une passe du harness lit au plus `SKILL.md` — base 9
fichiers le 2026-11-11 — contrôle à la prochaine passe — sinon : remettre le
fichier voisin qui a manqué.

### 2. Chaque PR commitait un fichier de revue sur `main`
**Pilier** : contexte. **Preuve** : 39 fichiers dans `.claude/reviews/`, un
par branche, utiles seulement au hook Stop de la session qui relit. **Remède**
: la tête relue s'écrit dans `.git/revue-en-boucle/<branche>`, que le hook
lit ; le dossier est supprimé. `bloquant.md` (34 lignes) tient en un
paragraphe de l'étape 2.
**Impact attendu** : fichiers sous `.claude/reviews/` sur `main` — base 39 —
attendu 0 — contrôle le 2026-11-18 — sinon : revenir au fichier commité.

### 3. La procédure de merge vivait dans un skill
**Pilier** : contexte. **Preuve** : l'attente de la CI, le squash et la
fermeture de l'issue étaient à l'étape 7 de `revue-en-boucle` ; une session
qui merge sur la demande du propriétaire sans relancer la revue ne la lisait
pas. **Remède** : déplacer dans `CLAUDE.md` § Qui merge, en cinq puces.

### 4. La revue périodique était une cérémonie que rien ne lançait
**Pilier** : contraintes. **Preuve** : 50 PR, aucune revue
(`2026-11-11-harness.md`, trouvaille 1). **Remède** : remplacer les quatre
étapes et l'étiquette `periodic-review` par une ligne : après un merge, à 20
PR depuis la dernière passe, proposer au propriétaire les deux revues.

### 5. Deux skills jamais lancés
**Pilier** : entropie. **Preuve** : aucun fil des 45 du projet ne nomme
`tenir-le-comptoir` ni `recherche-ux` ; aucun commit ne mentionne leur
résultat. 710 lignes avec `stage.mjs`. Les tests e2e pilotent déjà l'app
comme un membre. **Remède** : supprimer (proposé, le propriétaire tranche
dans la PR ; ils restent dans l'historique git).

## Ce qui reste
- `CLAUDE.md` garde ses règles, raccourcies ; les sections Tests et Base de
  données sont inchangées.
- Le paragraphe « partage du dépôt » de `relecteur-architecte.md` et la ligne
  d'architecture du tableau « Un fait, une place » appartiennent au fil
  « Vérifier DRY et l'architecture en couches » (docs/architecture.md).
