import { getCollection, type CollectionEntry } from 'astro:content';
import { blogUrl, isLang, type Lang } from './i18n';

/** Passer à true pour mettre le blog en ligne. En développement, il reste toujours visible. */
export const BLOG_PUBLISHED = false;

export const blogVisible = BLOG_PUBLISHED || import.meta.env.DEV;

export interface Post {
    entry: CollectionEntry<'blog'>;
    lang: Lang;
    /** Nom du fichier, qui sert d'adresse à l'article. */
    slug: string;
    url: string;
    /** La version dans l'autre langue, si elle existe. */
    translation?: Post;
}

/** Articles publiés, toutes langues confondues, du plus récent au plus ancien. */
export async function getAllPosts(): Promise<Post[]> {
    const entries = await getCollection('blog', ({ data }) => !data.draft);
    const posts: Post[] = entries
        .map((entry) => {
            const [lang, ...rest] = entry.id.split('/');
            if (!isLang(lang) || rest.length === 0) {
                throw new Error(`L'article "${entry.id}" doit être rangé dans un dossier de langue (fr/ ou en/).`);
            }
            const slug = rest.join('/');
            return { entry, lang, slug, url: blogUrl(lang, slug) };
        })
        .sort((a, b) => b.entry.data.publishDate.valueOf() - a.entry.data.publishDate.valueOf());

    // Le lien de traduction peut être écrit dans l'une ou l'autre des deux versions, ou dans les deux.
    const byId = new Map(posts.map((post) => [post.entry.id, post]));
    for (const post of posts) {
        const ref = post.entry.data.translation;
        if (!ref) continue;
        const other = byId.get(ref.id);
        if (!other) continue; // Traduction encore en brouillon.
        if (other.lang === post.lang) {
            throw new Error(`"${post.entry.id}" : la traduction "${other.entry.id}" doit être dans une autre langue.`);
        }
        for (const [a, b] of [[post, other], [other, post]]) {
            if (a.translation && a.translation !== b) {
                throw new Error(`"${a.entry.id}" est lié à deux traductions : "${a.translation.entry.id}" et "${b.entry.id}".`);
            }
            a.translation = b;
        }
    }
    return posts;
}

export async function getPosts(lang: Lang): Promise<Post[]> {
    return (await getAllPosts()).filter((post) => post.lang === lang);
}
