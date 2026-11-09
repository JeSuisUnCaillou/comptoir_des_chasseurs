# La synthèse

À lire aux étapes 3 à 7. Comment la matière devient des besoins, et d'où
vient chaque geste.

## Sommaire

- Les observations
- Les besoins
- La pesée
- Le rapport
- L'issue de besoin
- D'où vient la méthode

## Les observations

Une observation est une chose qu'un membre a faite ou rencontrée, assez
petite pour être déplacée seule (une « pépite » en recherche atomique) :

```
O12 · la commande de la garde · ordinateur · la grosse vente
Vu : a vendu 30 cuirs avec 22 en stock ; l'app a accepté, le stock est passé à -8.
Preuve : scene-2026-11-12/shots/014.png
Demandé : un blocage, ou un avertissement avant de valider.
```

- **Ce qui a été vu et ce qui a été demandé font deux lignes.** « Il faudrait
  un blocage » est une demande ; « le stock est passé à -8 sans un mot » est
  ce qui a été vu.
- **Plusieurs trouvailles peuvent faire une observation**, quand deux
  sessions ont rencontré la même chose ; elle liste alors les deux sessions,
  ce que la confiance compte.
- **Une trouvaille peut en faire plusieurs**, quand elle contient deux choses
  rencontrées à la fois.
- Ce qu'une session a aimé est une observation aussi : ça dit ce qu'un
  changement doit garder.

## Les besoins

Regroupe les observations par moment de la semaine (ouvrir le comptoir,
recevoir un chasseur, servir un client, faire l'inventaire, faire les
comptes, accueillir ou laisser partir un membre) et, dedans, par ce que le
membre essayait d'accomplir. Nomme chaque groupe comme une job story :

> **Quand** un client me demande une grosse quantité, **je veux** savoir
> tout de suite si on l'a, **pour** lui répondre sans sortir de la scène.

- **Demande pourquoi jusqu'à ce que ça parle du comptoir.** « Je veux un
  avertissement » → pourquoi ? « Parce que j'ai vendu ce qu'on n'avait pas »
  → pourquoi ça compte ? « Parce que le client a payé et qu'on ne peut pas le
  livrer, en plein RP. » Le besoin est la dernière réponse, pas la première.
- **Un besoin ne nomme aucun contrôle.** « Je veux une boîte de dialogue »
  est une solution ; « je veux savoir ce qu'une saisie va coûter avant de la
  faire » est un besoin.
- **Le test d'un bon groupe** : les observations dessous seraient toutes
  servies en le servant, et aucune en servant un autre.
- Ce qui se ressemble peut être deux besoins : deux soucis sur téléphone, l'un
  pour répondre vite à un client, l'autre pour faire l'inventaire, vont sous
  deux moments différents.

## La pesée

**La confiance**, d'après les observations sous le besoin :

| Confiance | Quand |
| --- | --- |
| haute | rencontré par trois sessions ou plus, ou par deux membres de rôles différents |
| moyenne | rencontré par deux sessions, ou plusieurs fois dans une |
| basse (une piste) | rencontré une fois |

**Le coût**, les trois facteurs de Nielsen lus pour le comptoir, puis une
note :

- *Fréquence* : combien de membres et de semaines le rencontrent.
- *Impact* : ce que ça coûte quand ça arrive : un compte faux, une visite
  bloquée, une saisie ralentie, un agacement.
- *Persistance* : une fois, ou chaque semaine.

| Note | Ce qu'elle veut dire ici |
| --- | --- |
| 4 | fausse les comptes ou perd des données |
| 3 | bloque une visite, ou coûte une soirée de saisie |
| 2 | ralentit, ou se contourne à chaque fois |
| 1 | cosmétique, ou rencontré une fois et appris |

Une note donnée seul n'est pas fiable : donne ta raison en une ligne, pour
que le propriétaire puisse ne pas être d'accord.

## Le rapport

```markdown
# Étude UX : <question>, <date>

<Cinq lignes : ce qui a été étudié, avec qui, les besoins dans l'ordre, ce
que le propriétaire doit décider.>

## Sources

| Session | Semaine | Membre | Appareil |

## Besoins

### B1 · <la job story, en bref> · coût 4 · confiance haute

**Quand** …, **je veux** …, **pour** ….

**Enseignement :** pourquoi l'app le sert mal aujourd'hui, en deux phrases.
**Vu :** O3, O12, O17 (les observations, une ligne chacune, avec les sessions).
**Règle qui gêne :** la ligne du README, ou aucune.
**Directions :** deux ou trois façons de le servir, une phrase chacune.
**Issues :** #n (rangée dedans), #m (bug, liée).

## Ce qui marche et doit rester

## Observations

<Toutes, numérotées, comme dans « Les observations » plus haut.>
```

## L'issue de besoin

Titre : le besoin avec les mots du membre, pas un contrôle (« Savoir ce qu'on
a en stock avant de promettre une vente »). Corps : la job story ;
l'enseignement ; la certitude de l'étude et pourquoi ; les observations avec
leurs preuves ; la règle du README qui gêne, citée, s'il y en a une ; les
directions ; les issues rangées dedans ; un lien vers le rapport. Finis par
le pied d'attribution que porte tout message GitHub.

Fermer une issue que le besoin couvre : un commentaire qui dit de quel besoin
elle fait désormais partie et que ses preuves y sont passées, puis ferme-la
comme doublon de l'issue de besoin.

## D'où vient la méthode

- La recherche atomique : des observations (« pépites ») avec leurs preuves,
  combinées en constats dont la confiance grandit avec chacune
  ([Dovetail](https://dovetail.com/blog/atomic-research)).
- L'affinity mapping : les observations groupées par ressemblance, chaque
  groupe nommé, puis classé par fréquence et gravité.
- Les job stories : situation, motivation, résultat, sans solution
  ([24 ways](https://24ways.org/2017/jobs-to-be-done-in-your-ux-toolbox/)).
- La gravité par fréquence, impact et persistance, sur une échelle de 0 à 4 ;
  la note d'un seul évaluateur n'est pas fiable
  ([notes de cours sur l'échelle de Nielsen](https://grouplab.cpsc.ucalgary.ca/saul/681/1997/kevin/severity.html)).
- Environ cinq participants par tour trouvent l'essentiel des problèmes, et
  plusieurs petits tours valent mieux qu'un grand
  ([MeasuringU](https://measuringu.com/?p=187)).
