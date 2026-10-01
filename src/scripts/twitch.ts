const CHANNEL = 'dremixam';
const BROADCASTER_ID = '35655924';
const LIVE_CHECK_INTERVAL = 2 * 60 * 1000;

export interface StreamSlot {
    start: Date;
    end: Date;
    title: string;
}

/** Twitch redirige l'aperçu d'une chaîne hors ligne vers une image par défaut. */
export async function isLive(channel = CHANNEL): Promise<boolean> {
    const res = await fetch(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-80x45.jpg`, { cache: 'no-store' });
    return res.ok && !res.redirected;
}

/** Prochain créneau du planning Twitch qui n'est pas encore terminé. */
export async function getNextStream(now = new Date()): Promise<StreamSlot | null> {
    const res = await fetch(`https://api.twitch.tv/helix/schedule/icalendar?broadcaster_id=${BROADCASTER_ID}`);
    if (!res.ok) return null;
    const slots = parseCalendar(await res.text())
        .filter((slot) => slot.end > now)
        .sort((a, b) => a.start.valueOf() - b.start.valueOf());
    return slots[0] ?? null;
}

function parseCalendar(ics: string): StreamSlot[] {
    const lines = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    const slots: StreamSlot[] = [];
    let event: Record<string, string> | null = null;

    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
            event = {};
        } else if (line === 'END:VEVENT' && event) {
            const start = parseDate(event.DTSTART);
            const end = parseDate(event.DTEND) ?? (start && new Date(start.valueOf() + 3600 * 1000));
            if (start && end && event.STATUS?.split(':').pop() !== 'CANCELLED') {
                slots.push({ start, end, title: unescapeText(event.SUMMARY?.slice(event.SUMMARY.indexOf(':') + 1) ?? '') });
            }
            event = null;
        } else if (event) {
            const name = line.match(/^[A-Z-]+/)?.[0];
            if (name) event[name] = line;
        }
    }
    return slots;
}

/** Lit une ligne DTSTART/DTEND : en UTC, dans un fuseau (TZID) ou une date seule. */
function parseDate(line: string | undefined): Date | null {
    const match = line?.match(/^[A-Z-]+((?:;[^:]*)?):(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!match) return null;
    const [, params, y, mo, d, h = '0', mi = '0', s = '0', utc] = match;
    const parts = [+y, +mo - 1, +d, +h, +mi, +s] as const;
    if (utc) return new Date(Date.UTC(...parts));

    const timeZone = params.match(/TZID=\/?([^;]+)/)?.[1];
    if (!timeZone) return new Date(...parts);
    try {
        const guess = Date.UTC(...parts);
        const first = guess - zoneOffset(guess, timeZone);
        return new Date(guess - zoneOffset(first, timeZone));
    } catch {
        return new Date(...parts);
    }
}

/** Avance du fuseau sur UTC, en millisecondes, à un instant donné. */
function zoneOffset(timestamp: number, timeZone: string): number {
    const format = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    });
    const p = Object.fromEntries(format.formatToParts(timestamp).map((part) => [part.type, Number(part.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(timestamp / 1000) * 1000;
}

function unescapeText(text: string): string {
    return text.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

/** "aujourd'hui à 18 h", "demain à 20 h 30", "samedi à 18 h", "samedi 10 octobre à 18 h". */
export function formatStreamDate(date: Date, now = new Date()): string {
    const minutes = date.getMinutes();
    return `${formatStreamDay(date, now)} à ${date.getHours()} h${minutes ? ` ${String(minutes).padStart(2, '0')}` : ''}`;
}

function formatStreamDay(date: Date, now: Date): string {
    const dayOffset = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
    const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    if (dayOffset === 0) return "aujourd'hui";
    // Entre minuit et 8 h, "demain" seul peut se comprendre comme le jour qui commence.
    if (dayOffset === 1) return now.getHours() < 8 ? `demain ${weekday}` : 'demain';
    if (dayOffset <= 5) return weekday;
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).valueOf();
}

/** Affiche le live dans le bouton Twitch s'il y en a un, sinon la date du prochain stream prévu. */
export function initTwitchButton(item: HTMLElement) {
    const info = item.querySelector<HTMLElement>('.twitch-info');
    const player = item.querySelector<HTMLElement>('.twitch-player');
    if (!info || !player) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    function showLive() {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', check);
        const iframe = document.createElement('iframe');
        iframe.src = `https://player.twitch.tv/?channel=${CHANNEL}&parent=${location.hostname}&muted=true&autoplay=true`;
        iframe.title = 'Live Twitch de DrEmixam';
        iframe.allow = 'autoplay; fullscreen';
        iframe.allowFullscreen = true;
        player!.querySelector('.twitch-player-inner')?.replaceChildren(iframe);
        info!.hidden = true;
        item.classList.add('is-live');
    }

    async function check() {
        if (document.hidden || item.classList.contains('is-live')) return;
        try {
            if ((await isLive()) && !item.classList.contains('is-live')) showLive();
        } catch {
            // Aperçu indisponible : on retentera au prochain passage.
        }
    }

    getNextStream()
        .then((slot) => {
            if (!slot || item.classList.contains('is-live')) return;
            info.textContent = `Prochain live ${formatStreamDate(slot.start)}`;
            if (slot.title) info.title = slot.title;
            info.hidden = false;
        })
        .catch(() => {});

    check();
    timer = setInterval(check, LIVE_CHECK_INTERVAL);
    document.addEventListener('visibilitychange', check);
}
