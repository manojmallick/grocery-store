import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Post, type PostSummary, type Settings } from "../api";
import { readingMinutes, useLocale } from "../i18n";
import { RichText } from "../richtext";
import { PostCard } from "./PostCard";

export function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t, langQuery } = useLocale();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<PostSummary[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug || !settings) return;
    const lang = langQuery(settings.defaultLocale);
    api
      .post(slug, lang)
      .then(async (p) => {
        setPost(p);
        const all = await api.posts(lang);
        setRelated(
          all
            .filter((o) => o.slug !== p.slug && o.tags.some((tag) => p.tags.includes(tag)))
            .slice(0, 3),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [slug, settings, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <main className="container">
        <p className="error">{error}</p>
        <Link to="/blog">{t("backToBlog")}</Link>
      </main>
    );
  }
  if (!post) {
    return (
      <main className="container">
        <p className="muted">{t("loading")}</p>
      </main>
    );
  }

  const author = post.author || settings?.defaultAuthor || "";
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <main className="container">
      <h1 style={{ marginBottom: "0.6rem" }}>{post.title}</h1>
      <div className="byline">
        {author && (
          <>
            <span className="avatar">{author.charAt(0).toUpperCase()}</span>
            <strong style={{ color: "var(--text)" }}>{author}</strong>
            <span>·</span>
          </>
        )}
        <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}</span>
        <span>·</span>
        <span>
          {readingMinutes(post.content)} {t("minRead")}
        </span>
        {post.tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      {post.coverImage && <img className="post-hero" src={post.coverImage} alt="" />}

      <RichText content={post.content} />

      <div className="share-row">
        <span className="muted">{t("share")}:</span>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`}
          target="_blank"
          rel="noreferrer"
        >
          𝕏
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t("linkCopied") : t("copyLink")}
        </button>
      </div>

      {related.length > 0 && (
        <>
          <h2>{t("related")}</h2>
          {related.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </>
      )}

      <p style={{ marginTop: "2rem" }}>
        <Link to="/blog">{t("backToBlog")}</Link>
      </p>
    </main>
  );
}
