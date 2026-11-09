# Passe 1

Tête relue : 4038baf (avant corrections)

- relecteur-architecte : le partage app/ components/ lib/ décrit par l'agent ne correspond pas au code de la PR #5 (SQL dans les actions et les pages, composants qui importent les actions) — corrigée en b631ef9.
- harness-engineer contredit CLAUDE.md sur l'issue de la revue périodique (Closes contre Refs) — corrigée en b631ef9.
- revue-en-boucle répète « squash » sans renvoyer à CLAUDE.md — corrigée en b631ef9.
- revue-en-boucle dit que les relecteurs n'ont aucun outil d'écriture, mais Bash est ouvert — corrigée en b631ef9.
- stage.mjs : la migration de --fresh suivait les variables Supabase du shell avant DATABASE_URL — corrigée en b631ef9, vérifiée avec POSTGRES_URL_NON_POOLING exporté.
- stage.mjs : close répondait avant l'arrêt, un open enchaîné échouait — corrigée en b631ef9, vérifiée par open/close/open.
- tenir-le-comptoir étape 5 sans « même --out » — corrigée en b631ef9.
- CLAUDE.md : la recette des tests n'installait pas Chromium — corrigée en b631ef9.
- README et scripts/vercel-build.sh de la PR #5 disent encore que les previews partagent la base de prod — hors de cette branche, laissée au propriétaire et à la PR #5.

Aucune trouvaille bloquante dans du code de l'app (la branche n'en touche pas) : pas de seconde passe.
