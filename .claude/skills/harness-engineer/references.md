# Les références de la méthode

Quatre textes fondent la méthode ; rouvre-les plutôt que de t'en souvenir :

- [What is harness engineering?](https://harnessengineering.academy/blog/what-is-harness-engineering-introduction-2026/)
  — les trois piliers : contexte, contraintes, entropie.
- [Harness Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
  (Fowler) — ce qui guide avant l'action contre ce qui contrôle après.
- [Spécifier, c'est coder](https://yoandev.co/specifier-c-est-coder) — la
  boucle de retour : chaque correction faite à la main demande « aurait-elle
  dû être dans un fichier du dépôt ? ».
- [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering)
  donne le reste, dont [Better Harness](https://github.com/QoderAI/better-harness),
  qui fait des preuves tirées des sessions la seule base d'une recommandation
  (« *missing or partial evidence remains explicit* »).

Pour la forme des fichiers eux-mêmes :

- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
  (Anthropic) — `SKILL.md` sous 500 lignes, description sous 1 024
  caractères, fichiers voisins à un niveau, sommaire au-delà de 100 lignes.
- [`writing-for-agents`](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md)
  et [`invocation.md`](https://github.com/mattpocock/skills/blob/main/.agents/invocation.md)
  (mattpocock) — pointeurs de contexte, hiérarchie de l'information, no-ops,
  négation, et appeler un skill par l'outil plutôt que par un `/nom` dans la
  prose.
- [Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
  (HumanLayer) — sous 300 lignes, universel, jamais le travail d'un linter.

La méthode est reprise du harness du dépôt
[soundboard](https://github.com/JeSuisUnCaillou/soundboard) du même
propriétaire, lui-même adapté du skill `harness-engineer` de
[numerique-gouv/oots-france](https://github.com/numerique-gouv/oots-france/tree/main/.claude/skills/harness-engineer).
