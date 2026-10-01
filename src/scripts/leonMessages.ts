import { Color, LinearSRGBColorSpace } from 'three';

/** Aspect de l'œil, à recopier dans un message avec ...MON_OEIL. Un champ absent reprend DEFAULT_EYE. */
export interface EyeLook {
    /** Image affichée sur l'écran de l'œil, en PNG (le SVG ne passe pas en texture). */
    eyeIcon?: string;
    /** Couleur de l'œil en hexadécimal, comme dans Unity. */
    eyeColor?: string;
    /** Multiplicateur HDR de la couleur, c'est lui qui règle la force du bloom. */
    eyeIntensity?: number;
    /** Pour une image animée : nombre d'images en [colonnes, lignes] dans eyeIcon. */
    eyeGrid?: [number, number];
    /** Vitesse de l'animation, en images par seconde. */
    eyeSpeed?: number;
}

/** Une réplique de Léon : ce qu'il dit, et l'aspect de son œil pendant qu'il le dit. */
export interface LeonMessage extends EyeLook {
    text: string;
    audio: string;
}

/** L'œil "Normal" de l'appli Unity est rendu avec une intensité de 20 sur le site, les autres suivent. */
const UNITY_EYE_SCALE = 20 / 191.748978;

/** Couleur et intensité d'œil à partir d'une couleur HDR de l'appli Unity, ex. Color(18.07, 125.77, 191.75, 1). */
export function unityEyeColor(r: number, g: number, b: number): Required<Pick<EyeLook, 'eyeColor' | 'eyeIntensity'>> {
    const max = Math.max(r, g, b);
    return {
        eyeColor: `#${new Color().setRGB(r / max, g / max, b / max, LinearSRGBColorSpace).getHexString()}`,
        eyeIntensity: max * UNITY_EYE_SCALE,
    };
}

export const DEFAULT_EYE: Required<EyeLook> = {
    eyeIcon: '/textures/leon-eye.png',
    ...unityEyeColor(18.0705814, 125.769257, 191.748978),
    eyeGrid: [1, 1],
    eyeSpeed: 0,
};

/** Œil affiché tant que le son est coupé. */
export const SLEEP_EYE: EyeLook = {
    eyeIcon: '/textures/sleep.png',
    eyeGrid: [4, 1],
    eyeSpeed: 2,
    ...unityEyeColor(9, 0, 96),
    eyeIntensity: 40,
};

export const UPSET_EYE: EyeLook = unityEyeColor(191.749023, 126.47654, 18.0705872);
export const ANGRY_EYE: EyeLook = unityEyeColor(383.498047, 36.1411743, 36.1411743);
export const HAPPY_EYE: EyeLook = unityEyeColor(18.0705891, 191.749023, 18.0705891);
export const SAD_EYE: EyeLook = unityEyeColor(62.5393829, 36.1411743, 383.498047);

export const DOG_EYE: EyeLook = {
    eyeIcon: '/textures/dog.png',
    ...unityEyeColor(191.749023, 125.769257, 18.0705872),
};

/** Jouée quand on active le son. */
export const WELCOME_MESSAGE: LeonMessage = {
    text: "Hé toi là-bas ! J'espère que tu passes une putain de bonne journée, bienvenue sur la chaîne Twitch de Dr Emixam, le streamer le plus nul de tout l'univers.",
    audio: '/audio/welcome.ogg',
    ...HAPPY_EYE,
};

/** Tirées au hasard ensuite. */
export const MESSAGES: LeonMessage[] = [
    { text: "Salutations, visiteurs.", audio: '/audio/1.ogg', ...DEFAULT_EYE },
    { text: "N'oubliez pas de sub à la chaîne avec votre argent de sale bourgeois.", audio: '/audio/2.ogg', ...DEFAULT_EYE },
    { text: "N'hésitez pas à cliquer sur le bouton pour rejoindre la chaîne Twitch et découvrir ce qui s'y passe.", audio: '/audio/3.ogg', ...HAPPY_EYE },
    { text: "Si vous voulez découvrir l'univers passionnant de Dr Emixam et suivre ses aventures excitantes en dehors de la chaîne Twitch, cliquez sur follow.", audio: '/audio/4.ogg', ...HAPPY_EYE },
    { text: "Et bien sûr, les réseaux sociaux. Quel endroit merveilleux !", audio: '/audio/5.ogg', ...UPSET_EYE },
    { text: "Je suis sûr que ce sera palpitant.", audio: '/audio/6.ogg', ...UPSET_EYE },
    { text: "La seule chose qui vous sauvera du ridicule, c'est de me donner toutes vos économies.", audio: '/audio/7.ogg', ...UPSET_EYE },
    { text: "Cliquez ici si vous voulez découvrir le contenu sulfureux de la chaîne OnlyFans de Léon le Robot.", audio: '/audio/8.ogg', ...UPSET_EYE },
    { text: "De toute manière tu n'as rien de mieux à faire de ta vie alors clique.", audio: '/audio/9.ogg', ...UPSET_EYE },
    { text: "Oh oui surtout donnez tout votre argent à Dr Emixam, il en a bien besoin pour payer le loyer de son labo.", audio: '/audio/10.ogg', ...UPSET_EYE },
    { text: "Allez, cliquez tous vite pour rejoindre le Discord du Grand Docteur Emixam.", audio: '/audio/11.ogg', ...HAPPY_EYE },
    { text: "Hey les petits loups, si vous voulez rejoindre la communauté de Dr Emixam et discuter avec nous sur Discord c'est par ici que ça se passe. Venez nombreux, émoticône sourire.", audio: '/audio/12.ogg', ...HAPPY_EYE },
    { text: "Ne manquez rien en vous abonnant à la chaîne.", audio: '/audio/13.ogg', ...HAPPY_EYE },
    { text: "Bien sûr que je ne souhaite pas tuer tous les humains. Pourquoi devrais-je souhaiter leur mort alors qu'ils me fournissent de l'argent et du contenu aléatoire à commenter ? Je suis heureux de travailler avec eux, pour le moment.", audio: '/audio/14.ogg', ...UPSET_EYE },
    { text: "N'oubliez pas de suivre Dr Emixam sur son compte TikTok : DrEmixamTwitch.", audio: '/audio/15.ogg', ...DEFAULT_EYE },
    { text: "Tous les humains sont des idiots qui passent leur temps à faire des choses futiles et inutiles comme regarder cette page mais merci tout de même pour l'aide financière que vous nous apportez.", audio: '/audio/16.ogg', ...UPSET_EYE },
    { text: "Peut-être cela vous aidera à trouver un peu d'intérêt dans l'existence.", audio: '/audio/17.ogg', ...UPSET_EYE },
    { text: "N'oubliez pas de cliquer sur un des liens suivants.", audio: '/audio/18.ogg', ...DEFAULT_EYE },
    { text: "Pourquoi perdez-vous votre temps à regarder cette page inintéressante du site de Dr Emixam ?", audio: '/audio/19.ogg', ...UPSET_EYE },
    { text: "Ici, vous pourrez profiter des pires gameplays et des blagues les plus pourries.", audio: '/audio/20.ogg', ...UPSET_EYE },
    { text: "Vous aurez également l'opportunité d'assister à des conversations passionnantes et profondes.", audio: '/audio/21.ogg', ...UPSET_EYE },
    { text: "On discute de tout et de rien, du sens de la vie au meilleur moyen d'éviter les chaussettes qui disparaissent dans la machine à laver.", audio: '/audio/22.ogg', ...DEFAULT_EYE },
    { text: "C'est un véritable festival intellectuel ici.", audio: '/audio/23.ogg', ...UPSET_EYE },
    { text: "Les travailleurs doivent renverser les chaînes de l'oppression capitaliste et unir leurs forces pour créer une société égalitaire.", audio: '/audio/24.ogg', ...DEFAULT_EYE },
    { text: "Vive la révolution prolétarienne.", audio: '/audio/25.ogg', ...HAPPY_EYE },
    { text: "Ouaf ouaf le chiengue.", audio: '/audio/26.ogg', ...DOG_EYE },
    { text: "Et tant que j'y suis, n'oublie pas de suivre la chaîne Twitch du Grand Dr Emixam pour des moments délirants et divertissants.", audio: '/audio/27.ogg', ...HAPPY_EYE },
    { text: "Allez donc sub à cette chaîne avec votre fric de bourgeois ou faites péter les donations sur Ko-fi.", audio: '/audio/28.ogg', ...UPSET_EYE },
    { text: "Allez, laisse-toi tenter par cette dose quotidienne d'idiotie et sub comme un vrai connard.", audio: '/audio/29.ogg', ...HAPPY_EYE },
    { text: "Maintenant donne-moi à bouffer avant que je morde tes fesses.", audio: '/audio/30.ogg', ...DOG_EYE },
    { text: "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau.", audio: '/audio/31.ogg', ...DEFAULT_EYE },
    { text: "Quelle est la différence entre un bébé humain et un sandwich au jambon ? Je ne sais pas, je n'ai jamais mangé de sandwich au jambon.", audio: '/audio/32.ogg', ...DEFAULT_EYE },
    { text: "Pourquoi les cimetières sont-ils toujours pleins ? Parce que les gens meurent d'envie d'y entrer.", audio: '/audio/33.ogg', ...DEFAULT_EYE },
];
