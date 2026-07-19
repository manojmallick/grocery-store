/**
 * Lightweight i18n: built-in UI-string dictionaries + a locale context.
 * Content translations live on posts/pages (edited in the admin); the active
 * locale is sent to the API as ?lang= and falls back to the default locale.
 * Add UI languages by extending UI_STRINGS.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UiKey =
  | "blog"
  | "home"
  | "allPosts"
  | "latestFromBlog"
  | "readMore"
  | "search"
  | "noPosts"
  | "noMatches"
  | "minRead"
  | "share"
  | "copyLink"
  | "linkCopied"
  | "related"
  | "backToBlog"
  | "featured"
  | "admin"
  | "notFound"
  | "notFoundHint"
  | "loading";

const UI_STRINGS: Record<string, Record<UiKey, string>> = {
  en: {
    blog: "Blog", home: "Home", allPosts: "All posts", latestFromBlog: "Latest from the blog",
    readMore: "Read more", search: "Search posts…", noPosts: "No published posts yet.",
    noMatches: "Nothing matches your search.", minRead: "min read", share: "Share",
    copyLink: "Copy link", linkCopied: "Link copied ✓", related: "Related posts",
    backToBlog: "← All posts", featured: "Featured", admin: "Admin",
    notFound: "Page not found", notFoundHint: "The page you're looking for doesn't exist.",
    loading: "Loading…",
  },
  es: {
    blog: "Blog", home: "Inicio", allPosts: "Todas las entradas", latestFromBlog: "Lo último del blog",
    readMore: "Leer más", search: "Buscar entradas…", noPosts: "Aún no hay entradas publicadas.",
    noMatches: "Nada coincide con tu búsqueda.", minRead: "min de lectura", share: "Compartir",
    copyLink: "Copiar enlace", linkCopied: "Enlace copiado ✓", related: "Entradas relacionadas",
    backToBlog: "← Todas las entradas", featured: "Destacado", admin: "Admin",
    notFound: "Página no encontrada", notFoundHint: "La página que buscas no existe.",
    loading: "Cargando…",
  },
  fr: {
    blog: "Blog", home: "Accueil", allPosts: "Tous les articles", latestFromBlog: "Derniers articles",
    readMore: "Lire la suite", search: "Rechercher…", noPosts: "Aucun article publié pour le moment.",
    noMatches: "Aucun résultat.", minRead: "min de lecture", share: "Partager",
    copyLink: "Copier le lien", linkCopied: "Lien copié ✓", related: "Articles similaires",
    backToBlog: "← Tous les articles", featured: "À la une", admin: "Admin",
    notFound: "Page introuvable", notFoundHint: "La page demandée n'existe pas.",
    loading: "Chargement…",
  },
  de: {
    blog: "Blog", home: "Start", allPosts: "Alle Beiträge", latestFromBlog: "Neues aus dem Blog",
    readMore: "Weiterlesen", search: "Beiträge durchsuchen…", noPosts: "Noch keine veröffentlichten Beiträge.",
    noMatches: "Keine Treffer.", minRead: "Min. Lesezeit", share: "Teilen",
    copyLink: "Link kopieren", linkCopied: "Link kopiert ✓", related: "Ähnliche Beiträge",
    backToBlog: "← Alle Beiträge", featured: "Empfohlen", admin: "Admin",
    notFound: "Seite nicht gefunden", notFoundHint: "Die gesuchte Seite existiert nicht.",
    loading: "Lädt…",
  },
  nl: {
    blog: "Blog", home: "Home", allPosts: "Alle berichten", latestFromBlog: "Nieuw op de blog",
    readMore: "Lees verder", search: "Zoek berichten…", noPosts: "Nog geen gepubliceerde berichten.",
    noMatches: "Geen resultaten.", minRead: "min leestijd", share: "Delen",
    copyLink: "Link kopiëren", linkCopied: "Link gekopieerd ✓", related: "Gerelateerde berichten",
    backToBlog: "← Alle berichten", featured: "Uitgelicht", admin: "Beheer",
    notFound: "Pagina niet gevonden", notFoundHint: "De pagina die je zoekt bestaat niet.",
    loading: "Laden…",
  },
  hi: {
    blog: "ब्लॉग", home: "होम", allPosts: "सभी पोस्ट", latestFromBlog: "ब्लॉग से नवीनतम",
    readMore: "और पढ़ें", search: "पोस्ट खोजें…", noPosts: "अभी तक कोई पोस्ट प्रकाशित नहीं।",
    noMatches: "कोई परिणाम नहीं मिला।", minRead: "मिनट में पढ़ें", share: "साझा करें",
    copyLink: "लिंक कॉपी करें", linkCopied: "लिंक कॉपी हो गया ✓", related: "संबंधित पोस्ट",
    backToBlog: "← सभी पोस्ट", featured: "विशेष", admin: "एडमिन",
    notFound: "पृष्ठ नहीं मिला", notFoundHint: "यह पृष्ठ मौजूद नहीं है।",
    loading: "लोड हो रहा है…",
  },
};

export const LOCALE_NAMES: Record<string, string> = {
  en: "English", es: "Español", fr: "Français", de: "Deutsch", nl: "Nederlands", hi: "हिन्दी",
  it: "Italiano", pt: "Português", ja: "日本語", zh: "中文", ar: "العربية", ru: "Русский",
};

interface LocaleContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: UiKey) => string;
  /** Append ?lang= for API calls (empty for default locale). */
  langQuery: (defaultLocale: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => UI_STRINGS.en[key],
  langQuery: () => "",
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState("en");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    const stored = localStorage.getItem("blog.locale");
    if (fromUrl) setLocaleState(fromUrl);
    else if (stored) setLocaleState(stored);
  }, []);

  const setLocale = (next: string) => {
    setLocaleState(next);
    localStorage.setItem("blog.locale", next);
    document.documentElement.lang = next;
  };

  const t = (key: UiKey) => (UI_STRINGS[locale] ?? UI_STRINGS.en)[key] ?? UI_STRINGS.en[key];
  const langQuery = (defaultLocale: string) =>
    locale && locale !== defaultLocale ? `?lang=${encodeURIComponent(locale)}` : "";

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, langQuery }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export function readingMinutes(content: string): number {
  const words = content.replace(/[#>*_`\[\]!:|-]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
