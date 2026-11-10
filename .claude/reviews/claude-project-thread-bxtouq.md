# Passe 1

Tête relue : 1ad2acd

- relecteur-bugs : redirection ouverte, « /.//example.com » devient « //example.com » après normalisation par URL et passait le contrôle (bloquant). Corrigée en 7c54c83, test e2e rouge sans la correction (cas « déjà connecté »), vert avec.
- relecteur-architecte : aucune trouvaille.

# Passe 2

Tête relue : 7c54c83

- relecteur-bugs : aucune trouvaille bloquante. Le formulaire du premier gérant ignore `suite` : écarté, il ne sert qu'à la toute première visite d'une base vide.
- relecteur-architecte : aucune trouvaille.

Tête relue : 7c54c83ffc80efa283349dfeaf4c15125bebca25
