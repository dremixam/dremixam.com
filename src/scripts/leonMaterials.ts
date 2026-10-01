import * as THREE from 'three';

export interface EmissiveGlowParams {
    type: 'emissiveGlow';
    glowSpeed?: number;
    /** Couleur émissive HDR linéaire venant de Unity (_Color_Emissive), peut dépasser 1. */
    colorEmissive?: [number, number, number];
    emissiveLowerValue?: number;
}

export interface FlipbookEyeParams {
    type: 'flipbookEye';
    /** [colonnes, lignes] de l'image du flipbook. */
    animationGridSize?: [number, number] | number;
    animationSpeed?: number;
    resolution?: number;
    shape?: number;
    bevel?: number;
    edgeWeight?: number;
    emissionIntensity?: number;
    /** _EmissionDepth : amplitude du parallaxe de l'écran. */
    emissionDepth?: number;
    iconScale?: number;
}

export type LeonShaderParams = EmissiveGlowParams | FlipbookEyeParams;

export interface LeonBaseColorParams {
    color?: [number, number, number];
    multiplier?: number;
    /** Index de la texture glTF de _DetachableMask.r. */
    detachableMask?: number;
    alphaCutoff?: number;
}

export interface LeonShaderUniforms {
    uTime: THREE.IUniform<number>;
    uAudioLevel: THREE.IUniform<number>;
}

type Shader = THREE.WebGLProgramParametersWithUniforms;

interface ShaderPatch {
    key: string;
    apply(shader: Shader): void;
}

/** Ajoute un patch au shader du matériau, tous ses patchs sont appliqués en une seule passe. */
function addPatch(material: THREE.MeshStandardMaterial, patch: ShaderPatch) {
    const patches: ShaderPatch[] = (material.userData.leonPatches ??= []);
    patches.push(patch);
    // Créés tout de suite, pour pouvoir être réglés avant la première compilation du shader.
    const uniforms: LeonShaderUniforms = (material.userData.leonShaderUniforms ??= {
        uTime: { value: 0 },
        uAudioLevel: { value: 0 },
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uAudioLevel = uniforms.uAudioLevel;
        shader.fragmentShader = 'uniform float uTime;\nuniform float uAudioLevel;\n' + shader.fragmentShader;
        for (const p of patches) p.apply(shader);
    };

    const key = patches.map((p) => p.key).join('+');
    material.customProgramCacheKey = () => key;
    material.needsUpdate = true;
}

/** Uniforms communs d'un matériau patché. */
export function getLeonUniforms(material: THREE.Material): LeonShaderUniforms | undefined {
    return material.userData.leonShaderUniforms;
}

/**
 * Pulsation émissive de Leon.shadergraph : la couleur varie entre sa pleine valeur et valeur x emissiveLowerValue
 * selon sin(temps x glowSpeed), masquée par la texture émissive. Seule la teinte de la couleur Unity est gardée.
 */
export function applyEmissiveGlow(material: THREE.MeshStandardMaterial, params: EmissiveGlowParams, intensity: number) {
    const raw = params.colorEmissive ?? [0, 1, 0];
    const max = Math.max(raw[0], raw[1], raw[2], 1e-4);
    const color = new THREE.Color(raw[0] / max, raw[1] / max, raw[2] / max).multiplyScalar(intensity);

    addPatch(material, {
        key: 'glow',
        apply(shader) {
            shader.uniforms.uGlowSpeed = { value: params.glowSpeed ?? 3 };
            shader.uniforms.uLowerValue = { value: params.emissiveLowerValue ?? 0.2 };
            shader.uniforms.uGlowColor = { value: color };
            shader.fragmentShader = `
                uniform float uGlowSpeed;
                uniform float uLowerValue;
                uniform vec3 uGlowColor;
            ` + shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #ifdef USE_EMISSIVEMAP
                    vec3 leonGlowMask = texture2D( emissiveMap, vEmissiveMapUv ).rgb;
                #else
                    vec3 leonGlowMask = vec3( 1.0 );
                #endif
                float leonPulse = ( sin( uTime * uGlowSpeed ) + 1.0 ) * 0.5;
                totalEmissiveRadiance = uGlowColor * mix( 1.0, uLowerValue, leonPulse ) * leonGlowMask;
                `
            );
        },
    });
}

/**
 * Écran de LeonEyeShader.shadergraph : l'image du flipbook s'affiche sur une grille de LED, avec un parallaxe,
 * atténuée sur les bords et pilotée par le niveau du son. Le bruit "broken" n'est pas reproduit.
 */
export function applyFlipbookEye(material: THREE.MeshStandardMaterial, params: FlipbookEyeParams, eyeColor: THREE.Color) {
    const grid = params.animationGridSize ?? 1;
    const gridSize = Array.isArray(grid) ? grid : [grid, grid];
    const eyeColorUniform = { value: new THREE.Color() };
    material.userData.leonEyeColor = eyeColorUniform;
    material.userData.leonEyeIntensity = params.emissionIntensity ?? 1;
    setEyeColor(material, eyeColor);
    const gridUniform = { value: new THREE.Vector2(gridSize[0], gridSize[1]) };
    const speedUniform = { value: params.animationSpeed ?? 8 };
    material.userData.leonEyeAnimation = { grid: gridUniform, speed: speedUniform };

    addPatch(material, {
        key: 'eye',
        apply(shader) {
            shader.uniforms.uGrid = gridUniform;
            shader.uniforms.uSpeed = speedUniform;
            shader.uniforms.uResolution = { value: params.resolution ?? 11 };
            shader.uniforms.uShape = { value: params.shape ?? 0.5 };
            shader.uniforms.uBevel = { value: params.bevel ?? 0.6 };
            shader.uniforms.uEdgeWeight = { value: params.edgeWeight ?? 0.25 };
            shader.uniforms.uIconScale = { value: params.iconScale ?? 1 };
            // Le nœud Parallax Mapping de Shader Graph multiplie son amplitude par 0.01.
            shader.uniforms.uDepth = { value: (params.emissionDepth ?? 0) * 0.01 };
            shader.uniforms.uEyeColor = eyeColorUniform;
            // Le mesh n'a pas de tangentes : le repère tangent est calculé avec les dérivées écran.
            shader.fragmentShader = `
                uniform vec2 uGrid;
                uniform float uSpeed;
                uniform float uResolution;
                uniform float uShape;
                uniform float uBevel;
                uniform float uEdgeWeight;
                uniform float uIconScale;
                uniform float uDepth;
                uniform vec3 uEyeColor;
            ` + shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #ifdef USE_EMISSIVEMAP
                    vec3 leonDpdx = dFdx( -vViewPosition );
                    vec3 leonDpdy = dFdy( -vViewPosition );
                    vec2 leonDuvx = dFdx( vEmissiveMapUv );
                    vec2 leonDuvy = dFdy( vEmissiveMapUv );
                    vec3 leonN = normalize( normal );
                    vec3 leonPerpY = cross( leonDpdy, leonN );
                    vec3 leonPerpX = cross( leonN, leonDpdx );
                    vec3 leonT = normalize( leonPerpY * leonDuvx.x + leonPerpX * leonDuvy.x );
                    vec3 leonB = normalize( leonPerpY * leonDuvx.y + leonPerpX * leonDuvy.y );
                    vec3 leonView = normalize( vViewPosition );
                    vec3 leonViewTS = normalize( vec3( dot( leonView, leonT ), dot( leonView, leonB ), dot( leonView, leonN ) ) );
                    leonViewTS.z += 0.42;
                    vec2 leonParallax = -0.5 * uDepth * leonViewTS.xy / leonViewTS.z;

                    vec2 leonIconUv = ( vEmissiveMapUv - 0.5 ) * uIconScale + 0.5 + leonParallax;
                    vec2 leonLocal = fract( leonIconUv * uResolution );

                    float leonFrame = mod( floor( uTime * uSpeed ), uGrid.x * uGrid.y );
                    vec2 leonTile = vec2( mod( leonFrame, uGrid.x ), floor( leonFrame / uGrid.x ) );
                    vec3 leonIcon = texture2D( emissiveMap, ( leonTile + clamp( leonIconUv, 0.0, 1.0 ) ) / uGrid ).rgb;

                    float leonDistance = mix(
                        distance( leonLocal, vec2( 0.5 ) ),
                        max( abs( leonLocal.x * 2.0 - 1.0 ), abs( leonLocal.y * 2.0 - 1.0 ) ),
                        uShape );
                    float leonLed = smoothstep( uEdgeWeight, uEdgeWeight + uBevel, 1.0 - leonDistance );
                    float leonFresnel = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 0.5 );

                    totalEmissiveRadiance = uEyeColor * leonIcon * leonLed * ( 1.0 - leonFresnel ) * uAudioLevel;
                #endif
                `
            );
        },
    });
}

/** Change la couleur HDR d'un œil patché par applyFlipbookEye, sans recompiler le shader. */
export function setEyeColor(material: THREE.Material, color: THREE.Color) {
    const uniform: THREE.IUniform<THREE.Color> | undefined = material.userData.leonEyeColor;
    uniform?.value.copy(color).multiplyScalar(material.userData.leonEyeIntensity ?? 1);
}

/** Change la grille [colonnes, lignes] et la vitesse (images par seconde) de l'animation de l'œil. */
export function setEyeAnimation(material: THREE.Material, grid: [number, number], speed: number) {
    const animation = material.userData.leonEyeAnimation;
    if (!animation) return;
    animation.grid.value.set(grid[0], grid[1]);
    animation.speed.value = speed;
}

/** Découpe de Leon.shadergraph : le corps est masqué là où _DetachableMask.r passe sous le seuil (panneaux amovibles). */
export function applyDetachableMask(material: THREE.MeshStandardMaterial, mask: THREE.Texture, cutoff: number) {
    addPatch(material, {
        key: 'detachable',
        apply(shader) {
            shader.uniforms.uDetachableMask = { value: mask };
            shader.uniforms.uDetachableCutoff = { value: cutoff };
            shader.fragmentShader = `
                uniform sampler2D uDetachableMask;
                uniform float uDetachableCutoff;
            ` + shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                #ifdef USE_MAP
                    if ( texture2D( uDetachableMask, vMapUv ).r < uDetachableCutoff ) discard;
                #endif
                `
            );
        },
    });
}
