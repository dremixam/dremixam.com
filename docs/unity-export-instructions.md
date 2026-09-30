# Export glTF pour le web — instructions pour le modkit

## Contexte

Le site dremixam.com affiche Léon en 3D dans le navigateur via Three.js. Il lui faut un export
glTF/`.glb` du personnage, en plus de l'export `.leon` (AssetBundle) déjà géré par le modkit pour
l'appli de stream. L'export Needle/UnityGLTF précédent a été retiré du projet : il apportait trop
de dépendances liées à Needle Engine pour ce qui est réellement nécessaire ici, et de toute façon
il ne savait pas exporter correctement les matériaux à Shader Graph custom (corps, panneaux, œil) —
un test avec `SkinLeonMKIII.glb` a confirmé que ces matériaux ressortaient sans aucune texture.

Objectif : une nouvelle fonctionnalité d'export dans le modkit, à côté de l'export `.leon` existant
(`Assets/Modkit/Editor/ExportExportableAssetPrefab.cs`), qui produit un `.glb` autonome et
"auto-descriptif" : géométrie + textures PBR standards là où c'est possible, et pour tout ce qui ne
rentre pas dans le modèle de matériau glTF (pulsation émissive animée, bruit procédural, flipbook de
l'œil), les valeurs des propriétés du Shader Graph exportées en `extras` plutôt que réécrites à la
main côté site.

Deuxième objectif, plus important à terme : **ne plus faire dépendre le site des noms d'objets**
(`Left Fan`, `Eye`, etc.). Le modkit connaît déjà, via ses composants "Exportable"
(`Assets/Modkit/ExportableComponent/*.cs`, ex. `RotateComponent`, `EyeComponent`), quel
comportement doit s'appliquer à quel objet. Le nouvel exporteur doit transporter cette information
dans le glTF (via `extras`) pour que le site la lise directement, au lieu de deviner via un nom.

## 1. Nouveau menu d'export

Ajouter dans `Assets/Modkit/Editor/` un script d'export glTF (ex. `ExportGltfForWeb.cs`), avec un
menu du style `Leon Tools/Export glTF (Web)`, sur le même modèle que le menu existant pour `.leon` :
même sélection de GameObject/prefab en entrée, mais sortie `.glb` au lieu de `.leon`.

## 2. Bibliothèque d'export

Needle/UnityGLTF a été retiré volontairement (trop de dépendances Needle Engine, pas assez de
contrôle). Deux options, à choisir selon le temps qu'on veut y mettre :

- **Option recommandée pour démarrer** : dépendre du package upstream `KhronosGroup/UnityGLTF`
  (le dépôt officiel Khronos, pas un fork Needle) via Package Manager (URL git). Il fait l'écriture
  du binaire glTF/glb, des accessors, du binaire des meshes, etc. — on branche juste la logique
  personnalisée (textures custom, `extras`) par-dessus via ses hooks d'export (`IGLTFExportPlugin`/
  callbacks de matériau et de nœud selon la version du package).
- **Option "zéro dépendance"** : écrire un writer glTF minimal directement dans le modkit (JSON +
  buffer binaire), en se limitant aux besoins réels (maillages skinnés simples, matériaux PBR de
  base, `extras`). Plus de travail, mais aucune dépendance externe à maintenir. À envisager si
  `UnityGLTF` s'avère à son tour trop lourd ou capricieux.

## 3. Textures à assigner dans les canaux glTF standards

Pour les matériaux qui ont un équivalent PBR direct (cadre métal, intérieur, câbles, circuit, et les
canaux qui existent pour le corps/panneaux/œil) :

| Matériau Unity | Texture source | Canal glTF |
|---|---|---|
| `LeonBodyMat`/`LeonPanelsMat`/`LeonPlutoniumLeakMat` | `_BaseColor` (`LeonTexture_Material_AlbedoTransparency.png`), **teinte calculée à l'export, alpha = masque de teinte**, voir section 9 | `baseColorTexture` (PNG RGBA) |
| idem | `LeonTexture_Material_Normal.png` | `normalTexture` |
| idem | `LeonTexture_Material_MetallicSmoothness.png` | `metallicRoughnessTexture` (attention à la conversion smoothness → roughness = 1 - smoothness) |
| idem | `LeonTexture_Material_Emission.png` | `emissiveTexture` (le masque émissif statique ; la pulsation/le bruit animés restent dans `extras`, voir plus bas) |
| `LeonEyeMat` | texture de base de l'œil s'il y en a une en dehors du flipbook | `baseColorTexture` |
| `LeonMetalFrameMat`, `LeonMetalInteriorMat`, `LeonCableMat`, `LeonCircuitMat` | déjà en PBR/URP-Lit standard | déjà géré par un export glTF classique, rien de spécial à faire |

Redimensionner ces textures pour le web avant export (suggestion : 1024² max pour les textures de
couleur/normal, 512² pour les masques) — c'est la version "allégée" demandée pour le site.

## 4. Paramètres de shader à écrire en `extras` (matériau)

Pour `LeonBodyMat`/`LeonPanelsMat`/`LeonPlutoniumLeakMat` (`Leon.shadergraph`), sur l'entrée
`materials[i].extras` du glTF :

```json
{
  "leonShader": {
    "type": "emissiveGlow",
    "glowSpeed": "<valeur de _Glow_Speed>",
    "colorEmissive": ["<r>", "<g>", "<b>"],
    "emissiveLowerValue": "<valeur de _Emissive_Lower_Value>"
  }
}
```

Le site calcule `émissif = colorEmissive × lerp(1, emissiveLowerValue, (sin(t × glowSpeed) + 1) / 2) × emissiveTexture`,
comme le graphe. Seule la teinte de `colorEmissive` est utilisée, son intensité est recalée côté site.
`_Noise_Scale`, `_Noise_Threshold` et `WhiteNoise.png` ne servent qu'aux paillettes (`_Glitter_Enabled`),
désactivées sur MKIII : inutile de les exporter pour l'instant. `_Noise_Rotation_Speed` n'est pas utilisé
par le graphe.

Pour `LeonEyeMat` (`LeonEyeShader.shadergraph`) :

```json
{
  "leonShader": {
    "type": "flipbookEye",
    "animationGridSize": "<valeur de _AnimationGridSize>",
    "animationSpeed": "<valeur de _AnimationSpeed>",
    "resolution": "<valeur de _Resolution>",
    "shape": "<valeur de _Shape>",
    "bevel": "<valeur de _Bevel>",
    "edgeWeight": "<valeur de _EdgeWeight>",
    "emissionIntensity": "<valeur de _EmissionIntensity>",
    "emissionDepth": "<valeur de _EmissionDepth>",
    "iconScale": "<valeur de _IconScale>"
  }
}
```

Ces valeurs doivent être lues directement depuis le matériau au moment de l'export (pas recopiées à
la main), pour qu'un futur réglage du Shader Graph dans Unity se répercute automatiquement au
prochain export.

## 5. Texture du flipbook de l'œil

`LeonEyeMat` utilise `Assets/Art/Common/Textures/Icons/wait.psd` comme feuille de sprites. L'export
doit produire un PNG (le format `.psd` n'est pas exploitable tel quel côté web) et le référencer
dans les `extras` du matériau (`"iconTexture": "wait.png"` par exemple) ou, si c'est plus simple,
via une texture glTF standard (`emissiveTexture` ou un canal libre) que le site saura retrouver par
convention.

## 6. Comportements par nœud (`extras` sur les nœuds)

Pour chaque objet exporté qui porte un composant "Exportable" reconnu du modkit, écrire dans
`nodes[i].extras.leonBehaviors` la liste des comportements avec leurs propriétés, par exemple :

```json
{
  "leonBehaviors": [
    { "type": "rotate", "axis": "y", "speed": 20 }
  ]
}
```

pour un objet avec un `RotateComponent`, ou :

```json
{
  "leonBehaviors": [
    { "type": "eye", "materialIndex": 1 }
  ]
}
```

pour l'objet portant un `EyeComponent` (fait le lien avec le matériau `LeonEyeMat` et ses `extras`
du point 4, via l'index de matériau).

Concrètement, dans le code de l'exporteur : après avoir laissé la bibliothèque glTF construire les
nœuds normalement, parcourir la hiérarchie source, pour chaque `GameObject` récupérer les composants
qui héritent d'une classe de base commune "Exportable" (si ce n'est pas déjà le cas, ajouter une
interface ou classe abstraite `ILeonExportableBehavior` implémentée par `RotateComponent`,
`EyeComponent`, etc., avec une méthode qui renvoie son propre JSON d'`extras` — ça centralise la
sérialisation dans chaque composant plutôt que dans l'exporteur, et un nouveau composant Exportable
n'aura qu'à implémenter cette méthode pour être automatiquement supporté par l'export web), puis
écrire ce JSON dans les `extras` du nœud glTF correspondant (retrouvé via le mapping GameObject →
node que la bibliothèque d'export construit pendant l'export).

## 7. Compression / poids

Une fois la géométrie et les textures en place, activer la compression pour une version web légère :
Draco ou Meshopt pour la géométrie, textures compressées (KTX2 si le pipeline de lecture web le
supporte facilement, sinon PNG optimisé/WebP en fallback simple).

## 8. Sortie attendue

Un unique fichier `SkinLeonMKIII.glb` (+ éventuellement les textures externes si non embarquées),
que l'utilisateur dépose dans le repo du site (`public/` côté Astro) pour remplacer l'actuel
`leon.glb`. Le site n'a plus besoin d'un fichier de paramètres séparé : tout ce qu'il lui faut
(comportements, paramètres de shader) est dans les `extras` du `.glb` lui-même.

## 9. Corrections après le premier export (`Assets/Modkit/Editor/Gltf/`)

Le premier `SkinLeonMKIII.glb` produit par `ExportGltfForWeb` est correct pour la géométrie, les
comportements et l'œil. Il reste un problème sur `Leon.shadergraph` (corps, panneaux, fuite de plutonium).

### Ce que fait le graphe

D'après le graphe (et sa traduction dans `Assets/MaterialXExport/SkinLeonMKIII.mtlx`, `NG_Leon`) :

- couleur de base = `lerp(_Color, _BaseColor.rgb, _BaseColor.a) × _BaseColor_Multiplier`, limitée à [0,1].
  L'alpha de la texture est un masque : là où il vaut 0, c'est `_Color` qui s'affiche (la bande violette
  du bas sur MKIII, et c'est ce qui change d'une skin à l'autre) ;
- si `_MaskTexture` est assignée (cas de `LeonPlutoniumLeakMat`), la couleur est ensuite mélangée
  avec cette texture, comme dans le graphe ;
- alpha = `_DetachableMask.r`, avec alpha clipping à 0,5 (réglé dans le graphe lui-même, pas dans
  `_AlphaClip`) : le corps est découpé là où se trouvent les panneaux détachables.

### Ce qui ne va pas dans l'export actuel

1. `GltfTextureBaker.BaseColor` encode en JPEG dès que le matériau n'est pas transparent : le canal
   alpha, qui sert de masque de teinte, est perdu.
2. `GltfMaterialExporter.ExportLeonBody` n'exporte ni `_Color`, ni `_BaseColor_Multiplier`, ni
   `_DetachableMask`.
3. `ApplyRenderState` ne met `alphaMode: MASK` que si `_AlphaClip` vaut 1 ; pour ce graphe la valeur
   est 0 alors que le clipping est actif, donc le corps n'est jamais découpé.

### Correction retenue : couleur calculée à l'export, alpha gardé comme masque de teinte

Comme dans Unity, l'alpha de la couleur de base n'est pas de la transparence mais un canal de
données (le masque de teinte). Il est conservé tel quel dans le glTF, et le masque détachable part
dans une texture séparée. `GltfTextureBaker.LeonBaseColor` produit `baseColorTexture` :

- pour chaque pixel : `lerp(_Color.linear × _BottomTexturePattern, rgb.linear, a)`, multiplié par
  `_BaseColor_Multiplier`, limité à [0,1], puis mélangé avec `_MaskTexture` si elle est assignée,
  reconverti en sRGB (`_BottomTexturePattern` vaut blanc quand elle n'est pas assignée, cas de MKIII) ;
- alpha = alpha d'origine de `_BaseColor`, **inchangé** (masque de teinte) ;
- toujours en **PNG** RGBA, et le matériau reste en `alphaMode: OPAQUE` (les viewers ignorent donc
  l'alpha et affichent la bonne couleur, sans découpe).

Les données brutes sont dans `materials[i].extras.leonBaseColor` :

```json
{
  "leonBaseColor": {
    "color": ["<r>", "<g>", "<b>"],
    "multiplier": "<valeur de _BaseColor_Multiplier>",
    "detachableMask": "<index de texture glTF>",
    "alphaCutoff": 0.5
  }
}
```

- `color` : `_Color` en linéaire. Pour changer de teinte, le site calcule
  `lerp(nouvelleTeinte, baseColorTexture.rgb, baseColorTexture.a)` (exact là où l'alpha vaut 0 ou 1) ;
- `detachableMask` : `_DetachableMask.r` seul, en PNG niveaux de gris (512² max). Absent si la
  propriété n'est pas assignée (panneaux, fuite de plutonium). Le site découpe le corps là où ce
  masque est sous `alphaCutoff`, pour reproduire le clipping du graphe.

La clé de cache du baker inclut la teinte et les masques : le corps et les panneaux, qui partagent la
même texture, ont chacun leur image.

### Points qui ne demandent pas de changement

- L'échelle (`Scaler` ×3, `Armature` ×100) : le site recentre le modèle et le remet à sa taille.
- `_EmissionColor` de l'œil vaut noir dans le matériau, puisque c'est l'appli qui choisit la couleur
  à l'exécution. Le site utilise sa propre couleur (cyan), c'est voulu.
- Les noms de nœuds avec espaces deviennent `Left_Fan` dans Three.js : le site ne s'appuie pas sur
  les noms, donc aucun impact.

## Compatibilité avec le site : ce que le site attend

Le site (voir `src/scripts/leon.ts` dans le repo dremixam.com) lit ce format de façon générique :

- Il parcourt tous les nœuds du glTF chargé et regarde `node.userData.leonBehaviors` (Three.js
  copie automatiquement `extras` dans `.userData`). Pour chaque entrée, il applique le comportement
  reconnu (`rotate` autour de l'axe local du nœud, `eye`). Un nœud sans `leonBehaviors` est ignoré.
- Il regarde `material.userData.leonShader` sur chaque matériau pour y greffer l'effet animé
  (`emissiveGlow` ou `flipbookEye`) avec les paramètres fournis. Le matériau reste un matériau PBR
  standard (éclairage, reflets, skinning conservés).
- Il applique `extras.leonBaseColor.detachableMask` (découpe sous `alphaCutoff`) ; la teinte, déjà
  calculée dans `baseColorTexture`, n'est pas réappliquée.
- Pour l'œil, il remplace le sprite par défaut (`wait`) par sa propre icône (`public/textures/leon-eye.png`,
  une seule image) et utilise sa propre couleur HDR, comme l'appli le fait à l'exécution.
- Le modèle est recentré et mis à l'échelle automatiquement, quelle que soit l'unité de l'export.
- Si un modèle n'a aucun `leonBehaviors`, le site retombe sur les anciens noms d'objets
  (`FansLeft`/`FansRight`/`Eye`).
