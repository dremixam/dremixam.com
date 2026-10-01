---
title: "Article de test"
description: "Toutes les fonctionnalités Markdown prises en charge par le blog, pour vérifier le rendu."
publishDate: 2026-09-30
tags: ["test", "markdown"]
---

Cet article sert uniquement à vérifier le rendu. Il n'a pas de contenu réel.

## Titres

## Titre de niveau 2

### Titre de niveau 3

#### Titre de niveau 4

Le titre de niveau 1 est réservé au titre de l'article.

## Texte

Un paragraphe avec du **gras**, de l'*italique*, du ***gras italique***, du ~~texte barré~~ et du `code en ligne`.

Un [lien vers le site](/), un [lien externe](https://astro.build/) et une adresse collée directement : https://dremixam.com.

Les guillemets "droits" et les apostrophes ' deviennent typographiques, et les points de suspension... aussi.

Une ligne\
coupée avec une barre oblique inverse en fin de ligne.

## Listes

- Élément de liste
- Autre élément
  - Sous-élément
  - Autre sous-élément
    - Troisième niveau
- Dernier élément

1. Première étape
2. Deuxième étape
   1. Sous-étape
   2. Autre sous-étape
3. Troisième étape

- [x] Tâche terminée
- [ ] Tâche à faire
- [ ] Autre tâche à faire

## Citation

> Une citation sur une ligne.
>
> Une citation peut contenir plusieurs paragraphes, du **gras** et du `code`.
>
> > Et même une citation imbriquée.

## Code

Un bloc sans langage :

```
texte brut
sans coloration
```

TypeScript :

```ts
interface Leon {
    name: string;
    fans: number;
}

function spin(leon: Leon, speed = 17.45): string {
    return `${leon.name} tourne à ${speed} rad/s`;
}
```

C# :

```csharp
public class RotateComponent : ExportableComponent
{
    [SerializeField] private Vector3 rotationSpeed;

    private void Update() => transform.Rotate(rotationSpeed * Time.deltaTime);
}
```

GLSL :

```glsl
float leonPulse = ( sin( uTime * uGlowSpeed ) + 1.0 ) * 0.5;
totalEmissiveRadiance = uGlowColor * mix( 1.0, uLowerValue, leonPulse );
```

Shell :

```bash
npm install
npm run build
```

JSON :

```json
{ "type": "rotate", "axis": "y", "speed": -17.4532928 }
```

Une ligne de code très longue, pour vérifier le défilement horizontal du bloc : `const resultat = uneFonctionAvecUnNomTresLong(premierParametre, deuxiemeParametre, troisiemeParametre, quatriemeParametre);`

```ts
const resultat = uneFonctionAvecUnNomTresLong(premierParametre, deuxiemeParametre, troisiemeParametre, quatriemeParametre);
```

## Tableau

| Matériau | Shader | Animé |
| :--- | :---: | ---: |
| `LeonBodyMat` | Leon.shadergraph | non |
| `LeonPanelsMat` | Leon.shadergraph | oui |
| `LeonEyeMat` | LeonEyeShader.shadergraph | oui |

## Image

![Le logo de la chaîne](/logo.svg)

## Séparateur

Au-dessus du séparateur.

---

En dessous du séparateur.

## HTML intégré

<kbd>Ctrl</kbd> + <kbd>C</kbd> pour copier, et un <mark>passage surligné</mark>.

<details>
<summary>Un bloc repliable</summary>

Le contenu apparaît au clic.

</details>

## Notes de bas de page

Une phrase avec une note[^1] et une autre note[^deux].

[^1]: Le contenu de la première note.
[^deux]: Une note peut avoir un nom au lieu d'un numéro.
