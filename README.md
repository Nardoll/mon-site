# Mon Site

Site personnel hébergé sur Netlify, connecté à ce repo GitHub.

## Stack
- HTML statique (fichiers générés avec Claude)
- Hébergement : Netlify (déploiement automatique à chaque push)
- Domaine : à configurer sur OVH/Porkbun (~5-8€/an)

## Workflow
1. Modifier les fichiers HTML dans VS Code
2. Prévisualiser en local avec l'extension Live Server
3. Commit + Push → le site se met à jour automatiquement sur Netlify en ~30 secondes

## Structure prévue
- Pages pour le club JDR
- Pages pour le club de lecture
- Sondages (via Tally ou Framaforms intégrés)
- Pages non indexées par Google (meta noindex)
- Certaines pages protégées par mot de passe (via Netlify)

## Notes techniques
- Branche principale : main
- Netlify surveille la branche main
- Pas de framework, HTML/CSS/JS pur
- Pour les pages privées : ajouter <meta name="robots" content="noindex"> dans le <head>