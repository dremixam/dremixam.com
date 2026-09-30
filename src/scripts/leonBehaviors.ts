import * as THREE from 'three';

export interface RotateBehavior {
    type: 'rotate';
    axis?: 'x' | 'y' | 'z';
    /** Radians per second. */
    speed: number;
}

export interface EyeBehavior {
    type: 'eye';
    materialIndex?: number;
}

export type LeonBehavior = RotateBehavior | EyeBehavior | { type: string; [key: string]: unknown };

export interface Spinner {
    object: THREE.Object3D;
    axis: THREE.Vector3;
    speed: number;
    rest: THREE.Quaternion;
}

export interface ResolvedBehaviors {
    spinners: Spinner[];
    /** The eye mesh, if found, for audio-reactive intensity driving. */
    eye: THREE.Object3D | null;
}

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function spinner(object: THREE.Object3D, axis: 'x' | 'y' | 'z', speed: number): Spinner {
    return { object, axis: AXES[axis], speed, rest: object.quaternion.clone() };
}

/**
 * Reads `node.userData.leonBehaviors` (glTF `extras` written by the modkit's web exporter,
 * see docs/unity-export-instructions.md) across the whole scene. Falls back to the legacy
 * name-based lookup (FansLeft/FansRight/Eye) for models without that metadata.
 */
export function resolveBehaviors(scene: THREE.Object3D): ResolvedBehaviors {
    const spinners: Spinner[] = [];
    let eye: THREE.Object3D | null = null;
    let sawExtras = false;

    scene.traverse((node) => {
        const behaviors = node.userData?.leonBehaviors as LeonBehavior[] | undefined;
        if (!behaviors) return;
        sawExtras = true;

        for (const behavior of behaviors) {
            if (behavior.type === 'rotate') {
                const rotate = behavior as RotateBehavior;
                spinners.push(spinner(node, rotate.axis ?? 'y', rotate.speed));
            } else if (behavior.type === 'eye') {
                eye = node;
            }
        }
    });

    if (!sawExtras) {
        const leftFan = scene.getObjectByName('FansLeft');
        const rightFan = scene.getObjectByName('FansRight');
        if (leftFan) spinners.push(spinner(leftFan, 'y', -20));
        if (rightFan) spinners.push(spinner(rightFan, 'y', 20));
        eye = scene.getObjectByName('Eye') ?? null;
    }

    return { spinners, eye };
}

const _spin = new THREE.Quaternion();

/** Rotates each spinner around its local axis, on top of its rest orientation. */
export function updateSpinners(spinners: Spinner[], elapsedTime: number) {
    for (const s of spinners) {
        s.object.quaternion.copy(s.rest).multiply(_spin.setFromAxisAngle(s.axis, s.speed * elapsedTime));
    }
}
