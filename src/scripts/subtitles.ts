const STORAGE_KEY = 'leon-subtitles';
/** Temps pendant lequel le dernier sous-titre reste affiché après la fin de la réplique. */
const LINGER_MS = 800;
/** Longueur maximale d'un sous-titre, soit environ deux lignes. */
const MAX_CHARS = 48;
const MIN_CHARS = 12;
/** Vitesse de lecture supposée quand la durée de l'audio est inconnue. */
const CHARS_PER_SECOND = 14;

export interface Subtitles {
    /** Affiche la réplique morceau par morceau, au rythme de l'audio. */
    show(text: string, audio: HTMLAudioElement): void;
    hide(): void;
}

/** Bouton d'activation des sous-titres et zone où s'affichent les répliques de Léon. */
export function initSubtitles(toggle: HTMLElement, display: HTMLElement): Subtitles {
    let enabled = readPreference();
    let speaking = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let playback = 0;

    function render() {
        toggle.setAttribute('aria-pressed', String(enabled));
        toggle.classList.toggle('bi-badge-cc-fill', enabled);
        toggle.classList.toggle('bi-badge-cc', !enabled);
        display.classList.toggle('visible', enabled && speaking);
    }

    toggle.addEventListener('click', () => {
        enabled = !enabled;
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
        } catch {
            // Stockage indisponible : le réglage ne sera pas retenu.
        }
        render();
    });

    render();

    return {
        show(text, audio) {
            clearTimeout(hideTimer);
            const id = ++playback;
            const cues = splitCues(text);
            speaking = cues.length > 0;
            render();
            if (!speaking) return;

            const ends = cueEnds(cues);
            let shown = -1;
            const update = () => {
                if (id !== playback) return;
                const duration = Number.isFinite(audio.duration) ? audio.duration : ends.total / CHARS_PER_SECOND;
                const progress = (audio.currentTime / duration) * ends.total;
                const index = ends.findIndex((end) => progress < end);
                const current = index === -1 ? cues.length - 1 : index;
                if (current !== shown) {
                    shown = current;
                    display.textContent = cues[current];
                }
                if (!audio.paused && !audio.ended) requestAnimationFrame(update);
            };
            update();
        },
        hide() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                playback++;
                speaking = false;
                render();
            }, LINGER_MS);
        },
    };
}

/** Fin de chaque sous-titre sur une échelle de caractères, une ponctuation comptant comme une pause. */
function cueEnds(cues: string[]): number[] & { total: number } {
    let sum = 0;
    const ends = cues.map((cue) => {
        const pause = /[.!?…]$/.test(cue) ? 10 : /[,;:]$/.test(cue) ? 5 : 0;
        sum += cue.length + pause;
        return sum;
    });
    return Object.assign(ends, { total: sum });
}

/** Découpe une réplique en sous-titres courts : par phrase, puis par virgule, puis par mots. */
export function splitCues(text: string): string[] {
    // Espaces insécables : jamais de ligne qui commence par "!" ou "?", ni "Dr" séparé du nom.
    const normalized = text
        .trim()
        .replace(/ ([!?:;»])/g, ' $1')
        .replace(/\b(Dr|Docteur) /g, '$1 ');
    const cues: string[] = [];
    for (const sentence of normalized.split(/(?<=[.!?…]) +/)) {
        let current = '';
        for (const clause of sentence.split(/(?<=[,;:]) +/)) {
            const joined = current ? `${current} ${clause}` : clause;
            if (joined.length <= MAX_CHARS) {
                current = joined;
                continue;
            }
            // Un début très court ("Allez,") reste avec la suite plutôt que de s'afficher seul.
            if (current.length < MIN_CHARS) {
                cues.push(...splitWords(joined));
                current = '';
                continue;
            }
            cues.push(current);
            current = '';
            if (clause.length <= MAX_CHARS) current = clause;
            else cues.push(...splitWords(clause));
        }
        if (current) cues.push(current);
    }
    return cues.filter((cue) => cue !== '');
}

/** Coupe un morceau trop long en parts de longueur proche. */
function splitWords(text: string): string[] {
    const count = Math.ceil(text.length / MAX_CHARS);
    const target = text.length / count;
    const parts: string[] = [];
    let current = '';
    for (const word of text.split(/ +/)) {
        if (current && parts.length < count - 1 && current.length + 1 + word.length / 2 > target) {
            // Un petit mot en fin de morceau ("une", "le", "de") passe au début du suivant.
            const cut = current.lastIndexOf(' ');
            const last = current.slice(cut + 1);
            if (cut > 0 && last.length <= 3) {
                parts.push(current.slice(0, cut));
                current = `${last} ${word}`;
            } else {
                parts.push(current);
                current = word;
            }
        } else {
            current = current ? `${current} ${word}` : word;
        }
    }
    if (current) parts.push(current);
    return parts;
}

function readPreference(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
        return false;
    }
}
