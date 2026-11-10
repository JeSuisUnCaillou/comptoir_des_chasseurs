# Harness — passe du 2026-11-10 : attendre la CI

Passe sur demande : « la méthode pour attendre la CI ne fonctionne pas bien »
(Caillou, fil « /harness-engineer », 2026-11-10 10:32). Issue #28.
Fenêtre : du 2026-11-09 au 2026-11-10, centrée sur les merges qui attendaient
la CI ; 3 fils lus (« Enregistrer un mouvement de septims seul », « Afficher
toutes les annonces sur l'accueil », celui-ci), la transcription de la session
`cse_014WRBL6xkFSoGPxY5v31bR8` de 10:27 à 10:32, 15 PR, 25 runs de `ci.yml`.
Précédent : premier audit.

## Impact des passes précédentes
| Issue | Mesure | Base | Résultat | Tenu / pas tenu / pas mesurable |
| --- | --- | --- | --- | --- |
| aucune | | | | |

## Mesures
| | Cette fenêtre | Précédente |
| --- | --- | --- |
| relances du propriétaire pour merger une PR déjà verte | 2 (PR #23, #26), plus la consigne du coordinateur pour #27 | — |
| délai entre la fin du run vert et le merge, PR que Claude devait merger seul | #23 : 52 s, #26 : 1 min 42 s, chacune après une relance | — |
| durée d'un run « Build et tests e2e » vert sur une PR (runs 53 à 68) | de 1 min 43 s à 4 min 09 s (`updated_at` − `run_started_at`) | — |
| forme du harness (`shape.py`) | `harness-engineer/SKILL.md` 169 lignes `!` ; rien d'autre | — |
| issues `harness` ouvertes en fin de fenêtre | 1 (#28, cette passe) | — |

## Trouvailles

### 1. `revue-en-boucle` fait attendre un événement « CI verte » qui n'arrive pas
**Pilier** : entropie
**Preuve** :
- `.claude/skills/revue-en-boucle/SKILL.md:73-75` : « suis la PR
  (`subscribe_pr_activity`), et sur son événement CI verte merge-la ».
- PR #26, session `cse_014WRBL6xkFSoGPxY5v31bR8` : abonnée à 10:27:44 ; un
  seul `check_suite.completed` sur la tête `9de3b66`, à 10:28:17, quand la
  suite Vercel (« Vercel Preview Comments ») était finie et que le job
  « Build et tests e2e » n'avait pas démarré (`started_at` 10:28:21). La
  session lit les checks à 10:28:23, les voit en cours, finit son tour. Le run
  65 finit vert à 10:30:07 : aucun réveil. Caillou écrit
  à 10:31:41 « c'est vert, t'attends quoi là ? ça fait 2 fois » ; merge à
  10:31:49.
- PR #23 : run 62 vert à 10:21:35, Caillou écrit « CI green » à 10:22:19,
  merge à 10:22:27 (fil « Enregistrer un mouvement de septims seul »).
- La session a noté le contournement dans la mémoire d'équipe
  (`caillou-preferences.md`, 2026-11-10 : rappel `send_later` d'environ
  4 minutes) ; le coordinateur l'a ensuite demandé à la main pour #27.
**Remède** : corriger — l'étape 7 programme un rappel `send_later` à chaque
tour qui finit en attendant la CI, et lit le check run « Build et tests e2e »
de la tête au lieu de se fier à l'événement.
**Impact attendu** : relances du propriétaire pour merger une PR verte — base
2 le 2026-11-10 — attendu 0 — contrôle le 2026-11-17 — sinon : un hook Stop qui refuse de finir un tour
sur une PR ouverte dont le check e2e tourne encore.
**Appliquée** : oui, commit « revue-en-boucle : attendre la CI par un rappel, pas par un événement »

### 2. Claude merge seul des PR que le propriétaire veut voir avant
**Pilier** : contexte
**Preuve** : Caillou, dans ce fil, le 2026-11-10 : à 10:34, « ne merge pas
des choses sans mon accord, montre moi à chaque fois une preview avant de
merge. Je peux avoir des feedbacks. » ; à 10:36, « les seules choses que tu
peux merge tout seul sont la doc, les tests, et le harness, ou les petits
fixs ». `revue-en-boucle` étape 7 faisait aussi merger seule l'infra et les
petites retouches d'une fonctionnalité, et ne demandait pas de montrer la
preview avant d'attendre l'accord.
**Remède** : corriger — l'étape 7 et `CLAUDE.md` § Qui merge reprennent ses
deux phrases.
**Impact attendu** : PR hors doc, tests, harness et petits correctifs mergées
sans que le propriétaire l'ait demandé après le lien de preview — base : #26
le 2026-11-10 (une retouche d'interface mergée seule) — attendu 0 — contrôle
le 2026-11-17 — sinon : un contrôle avant `merge_pull_request`.
**Appliquée** : oui, commits « Ne merger aucune PR sans l'accord du propriétaire » et « Rendre au merge seul la doc, les tests, le harness et les petits correctifs »

## Mémoires et instructions du projet rapatriées
| Source | Vers | À vider après le merge |
| --- | --- | --- |
| `caillou-preferences.md`, ligne du 2026-11-10 (rappel `send_later` après un push) | `revue-en-boucle/SKILL.md` étape 7 | oui, réduite à un renvoi |
| `caillou-preferences.md` 2026-11-09 et `MEMORY.md` « Caillou lets Claude merge small PRs once CI is green » | remplacées en mémoire par la consigne du 2026-11-10, que porte l'étape 7 | oui, réduite à un renvoi |

Le reste de la mémoire et les instructions du projet sont hors du sujet de
cette passe ; la prochaine passe rétrospective les rapatrie.

## Proposé hors du dépôt
- Auto-merge GitHub : proposé, refusé par le propriétaire le 2026-11-10
  (« non pas d'auto merge github »). Ne pas le reproposer en repli.

## Ce que je n'ai pas pu vérifier
- Pourquoi la fin du run GitHub Actions n'a pas produit d'événement : la
  plateforme dit que « CI results (green and red) » réveillent la session ;
  sur #26, seul l'événement de la suite Vercel est arrivé. Je ne lis pas le
  côté serveur.
- La transcription de la session de #23 avant 10:27 (page non lue) : le
  déroulé vient du fil et des horodatages GitHub.
