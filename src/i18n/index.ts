import fr from '../content/site.fr.json';
import en from '../content/site.en.json';

export type Lang = 'fr' | 'en';
export type Strings = typeof fr;

const dict: Record<Lang, Strings> = { fr, en: en as Strings };

export const strings = (lang: Lang): Strings => dict[lang];

/** Pick the right language from a {fr, en} object. */
export const tr = (v: { fr: string; en: string }, lang: Lang) => typo(v[lang], lang);

/** Localised path: '/work/x/' -> '/en/work/x/' for English. */
export const path = (p: string, lang: Lang) => (lang === 'fr' ? p : `/en${p}`);

/**
 * French typography: narrow no-break space before : ; ? ! and inside « »,
 * no-break space in "7 h 30", "2,80 €", "1 100 €". English text is returned as is.
 */
export function typo(text: string, lang: Lang): string {
  if (lang !== 'fr') return text;
  return text
    .replace(/ ([:;?!»])/g, ' $1')
    .replace(/« /g, '« ')
    .replace(/(\d) (?=\d{3}\b)/g, '$1 ')
    .replace(/(\d) (?=h\b|€|%|min\b)/g, '$1 ')
    .replace(/\bh (?=\d)/g, 'h ');
}

/** Contact details, in one place (NAP consistency for SEO). */
export const CONTACT = {
  name: 'Walid Birouk',
  studio: 'esPAce',
  email: 'walid.birouk@outlook.com',
  phone: '+33759583230',
  phoneDisplay: '+33 7 59 58 32 30',
  whatsapp: 'https://wa.me/33759583230',
  linkedin: 'https://www.linkedin.com/in/walid-birouk/',
  github: 'https://github.com/Walid-Birouk',
  // Empty = CTAs scroll to #contact.
  booking: 'https://cal.com/walid-birouk/first-call',
  // Web3Forms access key (public by design; it only lets the form send to this inbox).
  formKey: '64082cfe-0792-47ef-bbd6-d6838fc2b7df',
  city: 'Paris',
};
