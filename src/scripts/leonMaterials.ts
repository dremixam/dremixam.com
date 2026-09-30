import * as THREE from 'three';

export interface EmissiveGlowParams {
    type: 'emissiveGlow';
    glowSpeed?: number;
    /** Linear HDR emissive color from Unity (_Color_Emissive), can be far above 1. */
    colorEmissive?: [number, number, number];
    emissiveLowerValue?: number;
}

export interface FlipbookEyeParams {
    type: 'flipbookEye';
    /** [columns, rows] of the flipbook sprite sheet. */
    animationGridSize?: [number, number] | number;
    animationSpeed?: number;
    resolution?: number;
    shape?: number;
    bevel?: number;
    edgeWeight?: number;
    emissionIntensity?: number;
    /** _EmissionDepth: parallax amplitude of the screen. */
    emissionDepth?: number;
    iconScale?: number;
}

export type LeonShaderParams = EmissiveGlowParams | FlipbookEyeParams;

export interface LeonBaseColorParams {
    color?: [number, number, number];
    multiplier?: number;
    /** glTF texture index of _DetachableMask.r. */
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

/** Several patches can target the same material (e.g. cutout + glow), they are applied in one pass. */
function addPatch(material: THREE.MeshStandardMaterial, patch: ShaderPatch) {
    const patches: ShaderPatch[] = (material.userData.leonPatches ??= []);
    patches.push(patch);

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uAudioLevel = { value: 0 };
        shader.fragmentShader = 'uniform float uTime;\nuniform float uAudioLevel;\n' + shader.fragmentShader;
        for (const p of patches) p.apply(shader);
        material.userData.leonShaderUniforms = shader.uniforms;
    };

    const key = patches.map((p) => p.key).join('+');
    material.customProgramCacheKey = () => key;
    material.needsUpdate = true;
}

/** Uniforms of a patched material, available once three.js has compiled it. */
export function getLeonUniforms(material: THREE.Material): LeonShaderUniforms | undefined {
    return material.userData.leonShaderUniforms;
}

/**
 * Leon.shadergraph glow: the emissive color goes from full value to full value x emissiveLowerValue
 * following sin(time x glowSpeed), masked by the emissive texture. Only the hue of the Unity color
 * is kept: its magnitude comes from a gamma conversion of an HDR value and is not meaningful here.
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
 * LeonEyeShader.shadergraph screen: the current flipbook frame (emissive texture) is shown
 * on a grid of round/square LEDs, dimmed at grazing angles and driven by the audio level.
 * A parallax offset (URP ParallaxOffset1Step, flat heightmap) makes the screen look recessed.
 * The "broken" noise is not reproduced. The eye color is set at runtime by the app, so the
 * site provides it (as an HDR color, it has to shine through the dark glass).
 */
export function applyFlipbookEye(material: THREE.MeshStandardMaterial, params: FlipbookEyeParams, eyeColor: THREE.Color) {
    const grid = params.animationGridSize ?? 1;
    const gridSize = Array.isArray(grid) ? grid : [grid, grid];

    addPatch(material, {
        key: 'eye',
        apply(shader) {
            shader.uniforms.uGrid = { value: new THREE.Vector2(gridSize[0], gridSize[1]) };
            shader.uniforms.uSpeed = { value: params.animationSpeed ?? 8 };
            shader.uniforms.uResolution = { value: params.resolution ?? 11 };
            shader.uniforms.uShape = { value: params.shape ?? 0.5 };
            shader.uniforms.uBevel = { value: params.bevel ?? 0.6 };
            shader.uniforms.uEdgeWeight = { value: params.edgeWeight ?? 0.25 };
            shader.uniforms.uIconScale = { value: params.iconScale ?? 1 };
            // Shader Graph's Parallax Mapping node scales its amplitude by 0.01.
            shader.uniforms.uDepth = { value: (params.emissionDepth ?? 0) * 0.01 };
            shader.uniforms.uEyeColor = { value: eyeColor.clone().multiplyScalar(params.emissionIntensity ?? 1) };
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
                    // The mesh has no tangents: build the tangent frame from screen-space derivatives.
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

/** Leon.shadergraph cutout: the body is clipped where _DetachableMask.r is below the cutoff (detachable panels). */
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
