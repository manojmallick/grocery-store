import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Page, type Settings } from "../api";
import { useLocale } from "../i18n";
import { RichText } from "../richtext";

export function PageView() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t, langQuery } = useLocale();
  const [page, setPage] = useState<Page | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug || !settings) return;
    setPage(null);
    api
      .page(slug, langQuery(settings.defaultLocale))
      .then(setPage)
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [slug, settings, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <main className="container">
        <p className="error">{error}</p>
        <Link to="/">{t("home")} →</Link>
      </main>
    );
  }
  if (!page) {
    return (
      <main className="container">
        <p className="muted">{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>{page.title}</h1>
      {page.coverImage && <img className="post-hero" src={page.coverImage} alt="" />}
      <RichText content={page.content} />
    </main>
  );
}
