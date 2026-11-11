# Passe 1

Tête relue : 073a596 (diff contre origin/claude/project-thread-ql68ke, la PR du super admin).

- relecteur-architecte : aucune trouvaille.
- Fenêtre de déploiement : un rôle changé ou un membre créé par l'ancien code pendant le build n'atteint pas shop_members. Rejetée comme bloquante : fenêtre d'une minute ou deux pour une dizaine de membres ; la PR qui retire members.role rattrapera les membres sans boutique. Dit dans la PR et dans #113.
- Aucune écriture testée contre une autre boutique : corrigée en 6fe6963 (annuler, régler, modifier une marchandise avec le numéro d'une autre boutique ; vu rouge sans le filtre de boutique de cancelTransaction).
- Aucun test qu'un compte d'une autre boutique n'entre pas : corrigée en 6fe6963. Le compte désactivé refusé au login est déjà couvert par membres.spec.ts (le rôle se change maintenant dans shop_members).

Suite e2e : 99 verts.
Tête relue : 6fe6963609ff64ee0e1fb5bef738185ae12588eb
