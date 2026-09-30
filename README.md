# DrEmixam.com

Mon site personnel : [https://dremixam.com/](https://dremixam.com/)

## Présentation

Ce site web présente mon univers, mes projets, et quelques ressources multimédias. Il est statique
(généré avec [Astro](https://astro.build/)), rapide et simple à parcourir.

## Fonctionnalités principales
- Liens vers mes différents projets et réseaux, boutique, etc.
- Présence de Léon, le robot co-animateur 3D, personnage de ma chaîne Twitch
- Interactivité avec Léon
- Un blog technique sur la conception de mes projets

Tout est accessible directement depuis la page d’accueil.

## Développement

```bash
npm install
npm run dev      # serveur de dev
npm run build    # build statique dans dist/
```

## Structure

- `src/pages/` — les pages du site (accueil, blog)
- `src/content/blog/` — les articles du blog, en Markdown
- `src/scripts/leon.ts` — la scène Three.js de Léon (chargement du modèle, shaders, interactions)
- `public/` — fichiers statiques servis tels quels (audio, glb, textures, CNAME...)
- `docs/unity-export-instructions.md` — instructions pour exporter une nouvelle skin de Léon depuis
  le projet Unity source vers un `.glb` exploitable par ce site

Le déploiement se fait via GitHub Actions (`.github/workflows/deploy.yml`) vers GitHub Pages.

## Crédits

- Réalisé par [DrEmixam](https://github.com/DrEmixam/)
- Modèle 3d de Léon par H__S
- Merci aux visiteurs et à la communauté !