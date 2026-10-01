---
title: "Test article"
description: "All the Markdown features supported by the blog, to check the rendering."
publishDate: 2026-09-30
tags: ["test", "markdown"]
translation: fr/article-de-test
---

This article is only here to check the rendering. It has no real content.

## Headings

## Level 2 heading

### Level 3 heading

#### Level 4 heading

The level 1 heading is used for the article title.

## Text

A paragraph with **bold**, *italic*, ***bold italic***, ~~strikethrough~~ and `inline code`.

A [link to the site](/), an [external link](https://astro.build/) and a raw address: https://dremixam.com.

"Straight" quotes and apostrophes (it's) become typographic, and so do the dots...

A line\
broken with a backslash at the end of the line.

## Lists

- List item
- Another item
  - Sub-item
  - Another sub-item
    - Third level
- Last item

1. First step
2. Second step
   1. Sub-step
   2. Another sub-step
3. Third step

- [x] Done task
- [ ] Task to do
- [ ] Another task to do

## Quote

> A quote on one line.
>
> A quote can have several paragraphs, some **bold** and some `code`.
>
> > And even a nested quote.

## Code

A block with no language:

```
plain text
with no highlighting
```

TypeScript:

```ts
interface Leon {
    name: string;
    fans: number;
}

function spin(leon: Leon, speed = 17.45): string {
    return `${leon.name} spins at ${speed} rad/s`;
}
```

C#:

```csharp
public class RotateComponent : ExportableComponent
{
    [SerializeField] private Vector3 rotationSpeed;

    private void Update() => transform.Rotate(rotationSpeed * Time.deltaTime);
}
```

GLSL:

```glsl
float leonPulse = ( sin( uTime * uGlowSpeed ) + 1.0 ) * 0.5;
totalEmissiveRadiance = uGlowColor * mix( 1.0, uLowerValue, leonPulse );
```

Shell:

```bash
npm install
npm run build
```

JSON:

```json
{ "type": "rotate", "axis": "y", "speed": -17.4532928 }
```

A very long line of code, to check the horizontal scroll of the block:

```ts
const result = aFunctionWithAVeryLongName(firstParameter, secondParameter, thirdParameter, fourthParameter);
```

## Table

| Material | Shader | Animated |
| :--- | :---: | ---: |
| `LeonBodyMat` | Leon.shadergraph | no |
| `LeonPanelsMat` | Leon.shadergraph | yes |
| `LeonEyeMat` | LeonEyeShader.shadergraph | yes |

## Image

![The channel logo](/logo.svg)

## Separator

Above the separator.

---

Below the separator.

## Inline HTML

<kbd>Ctrl</kbd> + <kbd>C</kbd> to copy, and a <mark>highlighted passage</mark>.

<details>
<summary>A collapsible block</summary>

The content shows on click.

</details>

## Footnotes

A sentence with a note[^1] and another note[^two].

[^1]: The content of the first note.
[^two]: A note can have a name instead of a number.
