import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type PostSummary, type Settings } from "../api";
import { useLocale } from "../i18n";
import { PostCard } from "./PostCard";

export function PostList() {
  const { locale, t, langQuery } = useLocale();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const activeTag = params.get("tag") ?? "";

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!settings) return;
    api
      .posts(langQuery(settings.defaultLocale))
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [settings, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const allTags = useMemo(() => [...new Set(posts.flatMap((p) => p.tags))].sort(), [posts]);
  const needle = query.trim().toLowerCase();
  const visible = posts.filter(
    (post) =>
      (!activeTag || post.tags.includes(activeTag)) &&
      (!needle ||
        post.title.toLowerCase().includes(needle) ||
        post.excerpt.toLowerCase().includes(needle)),
  );
  const featured = !activeTag && !needle ? visible.find((p) => p.featured) : undefined;
  const rest = featured ? visible.filter((p) => p.id !== featured.id) : visible;

  return (
    <main className="container wide">
      <h1 style={{ marginBottom: 4 }}>{t("blog")}</h1>
      <div className="search-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          style={{ maxWidth: 320 }}
        />
        <span>
          {allTags.map((tag) => (
            <span
              key={tag}
              className={`tag clickable ${tag === activeTag ? "active" : ""}`}
              onClick={() => setParams(tag === activeTag ? {} : { tag })}
            >
              {tag}
            </span>
          ))}
        </span>
      </div>

      {featured && (
        <div className="featured-card">
          {featured.coverImage && <img src={featured.coverImage} alt="" />}
          <div className="overlay">
            <span className="kicker">★ {t("featured")}</span>
            <h2>
              <Link to={`/post/${featured.slug}`}>{featured.title}</Link>
            </h2>
            <p>{featured.excerpt}</p>
          </div>
        </div>
      )}

      {loaded && visible.length === 0 && (
        <p className="muted">
          {needle || activeTag ? t("noMatches") : t("noPosts")}
        </p>
      )}
      {rest.map((post) => (
        <PostCard key={post.id} post={post} onTag={(tag) => setParams({ tag })} />
      ))}
    </main>
  );
}
