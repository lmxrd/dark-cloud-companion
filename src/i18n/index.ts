import { en, type MessageKey } from "./en";

export type { MessageKey };
export const defaultLocale = "en";
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const translators = new Map<Locale, Translate>();

/**
 * The translate function for a locale. It is the same function on every call, so components can list
 * it as a memo or effect dependency without recomputing on every render.
 */
/** `useTranslations` outside components (a class component, module code): it is not a hook. */
export const getTranslations = (locale: Locale = defaultLocale): Translate =>
  useTranslations(locale);

export function useTranslations(locale: Locale = defaultLocale): Translate {
  let t = translators.get(locale);
  if (!t) {
    const dict = dictionaries[locale];
    t = (key, vars) => {
      const s = dict[key] ?? en[key];
      return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
    };
    translators.set(locale, t);
  }
  return t;
}
