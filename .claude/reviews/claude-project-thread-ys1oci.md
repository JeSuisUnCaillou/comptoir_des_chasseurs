# Passe 1

Tête relue : 073a596 (diff contre origin/claude/project-thread-ql68ke, la PR du super admin).

- relecteur-architecte : aucune trouvaille.
- Fenêtre de déploiement : un rôle changé ou un membre créé par l'ancien code pendant le build n'atteint pas shop_members. Rejetée comme bloquante : fenêtre d'une minute ou deux pour une dizaine de membres ; la PR qui retire members.role rattrapera les membres sans boutique. Dit dans la PR et dans #113.
- Aucune écriture testée contre une autre boutique : corrigée en 6fe6963 (annuler, régler, modifier une marchandise avec le numéro d'une autre boutique ; vu rouge sans le filtre de boutique de cancelTransaction).
- Aucun test qu'un compte d'une autre boutique n'entre pas : corrigée en 6fe6963. Le compte désactivé refusé au login est déjà couvert par membres.spec.ts (le rôle se change maintenant dans shop_members).

Suite e2e : 99 verts.
Tête relue : 6fe6963609ff64ee0e1fb5bef738185ae12588eb

# Rebase sur la branche du super admin

Rebasée sur origin/claude/project-thread-ql68ke (aacff0b) sans conflit ; rien de cette PR n'a changé. tsc, drizzle-kit check, test:legacy et suite e2e (99 verts) repassés.
Tête relue : c5c6693fd5b56f25e107f5aebcf8e2f11d6b9b06

# Rebase sur main

#112 mergée : branche rebasée sur origin/main (d2c0343, avec #116 et #119) sans conflit ; ALERT pris dans e2e/helpers.ts. Code de l'app inchangé. Base neuve migrée, test:legacy et suite e2e (104 verts) repassés.
Tête relue : 5cf46779d5bd47b262dcb48f7eb0759a2a331775

# PR #124 (une adresse par boutique), passe 1

Branche repartie de main après le merge de #115 et #122. Tête relue : 5331d67.

- relecteur-architecte : « boutiques » et « invitation » réservées sans page ; corrigée en 5c12be2 (retirées, la PR 3 ajoutera celle qu'elle sert).
- relecteur-bugs : aucun bug ; deux tests manquants, corrigés en 5c12be2 (membre désactivé au comptoir mais actif ailleurs ; ancienne adresse avec ses filtres).

Suite e2e : 108 verts.
Tête relue : 5c12be2512e22c758cce0307889718c2c8e164b2
