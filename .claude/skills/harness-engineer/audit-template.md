# Le modèle d'audit

À lire à l'étape 5. L'audit va dans `.claude/audits/AAAA-MM-JJ-harness.md`,
ou `AAAA-MM-JJ-harness-<sujet>.md` pour une passe sur demande, comme premier
commit de la branche. Une trouvaille appliquée sans sa ligne `Impact attendu`
n'est pas finie.

```md
# Harness — passe du AAAA-MM-JJ

Fenêtre : du … au …, <n> sessions sur le comptoir (<n> d'autres dépôts écartées), <n> fils, <n> PR, <n> issues touchées.
Précédent : <lien vers l'audit précédent, ou « premier »>.

## Impact des passes précédentes
| Issue | Mesure | Base | Résultat | Tenu / pas tenu / pas mesurable |
| --- | --- | --- | --- | --- |

## Mesures
| | Cette fenêtre | Précédente |
| --- | --- | --- |
| corrections du propriétaire dans les sessions et les fils | | |
| questions posées dont la réponse était écrite | | |
| pushes par PR (médiane, max) | | |
| runs de CI rouges sur une PR, puis verts | | |
| coût par session dans `external_metadata.usage.cost_usd` (médiane, total) | | |
| fichiers du harness changés | | |
| forme du harness (`shape.py`) : fichiers au-dessus d'un seuil, caractères de description, doublons | | |
| issues `harness` ouvertes en fin de fenêtre | | |

## Trouvailles
### <n>. <une ligne : le défaut>
**Pilier** : contexte | contraintes | entropie
**Preuve** : <titre et date de la session, événement, ou message du fil, ou fichier:ligne, ou PR, ou la mesure — rassemblée dans cette passe>
**Remède** : <écrire | déplacer | raccourcir | contrôler | corriger | fusionner | supprimer | rapatrier | mesurer> — <où, en une phrase>
**Impact attendu** : <mesure> — base <valeur, date> — attendu <sens ou seuil> — contrôle le <date> — sinon : <repli>
**Appliquée** : oui, commit « … » | proposée, attend une réponse

## Mémoires et instructions du projet rapatriées
| Source (fichier de mémoire, ligne de `MEMORY.md`, instruction du projet) | Vers, ou « déjà dans <fichier> » | À vider après le merge |

## Proposé hors du dépôt
<script de setup, hook SessionStart, instructions du projet : le changement, et où le propriétaire le fait>

## Ce que je n'ai pas pu vérifier
<sources hors d'atteinte, sessions trop longues pour être lues en entier, et pourquoi>
```

La réponse dans le fil : le lien de la PR, le nombre de trouvailles
appliquées et proposées, les deux ou trois qui changent le plus, une ligne
d'impact attendu par trouvaille appliquée, les mémoires à vider après le
merge. Pas le détail : il est dans l'audit et la PR.
