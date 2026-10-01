export const LANGS = ['fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'fr';

export function isLang(value: string): value is Lang {
    return (LANGS as readonly string[]).includes(value);
}

/** Adresse du blog dans une langue, ou d'un de ses articles. */
export function blogUrl(lang: Lang, slug?: string): string {
    return slug ? `/blog/${lang}/${slug}/` : `/blog/${lang}/`;
}

const dateLocales: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };

export function formatDate(date: Date, lang: Lang): string {
    return date.toLocaleDateString(dateLocales[lang], { year: 'numeric', month: 'long', day: 'numeric' });
}

export const ui = {
    fr: {
        siteName: 'Le Laboratoire du Dr Emixam',
        blogTitle: 'Le blog',
        blogIntro: 'Des articles techniques sur la conception de mes projets.',
        backHome: 'Retour au labo',
        allPosts: 'Tous les articles',
        newBadge: 'Nouveau',
        noPosts: "Aucun article pour l'instant.",
        languageSwitch: 'Langue',
        // Textes de lien vers cette langue, écrits dans cette langue.
        blogInThisLang: 'Le blog en français',
        articleInThisLang: 'Lire en français',
    },
    en: {
        siteName: 'Le Laboratoire du Dr Emixam',
        blogTitle: 'The blog',
        blogIntro: 'Technical articles about how I build my projects.',
        backHome: 'Back to the lab',
        allPosts: 'All articles',
        newBadge: 'New',
        noPosts: 'No articles yet.',
        languageSwitch: 'Language',
        blogInThisLang: 'Blog in English',
        articleInThisLang: 'Read in English',
    },
} satisfies Record<Lang, Record<string, string>>;
