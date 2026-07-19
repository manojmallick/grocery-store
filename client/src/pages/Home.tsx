import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type HomeConfig, type PostSummary, type Settings } from "../api";
import { useLocale } from "../i18n";
import { Reveal } from "../motion";
import { PostCard } from "./PostCard";

export function HomePage() {
  const { locale, t, langQuery } = useLocale();
  const [home, setHome] = useState<HomeConfig | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    api.home().then(setHome).catch(() => {});
    api.settings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!settings) return;
    api
      .posts(langQuery(settings.defaultLocale))
      .then((p) => setPosts(p.slice(0, 3)))
      .catch(() => {});
  }, [settings, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!home) {
    return (
      <main className="container">
        <p className="muted">{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="container wide">
      <section className="hero">
        <div className="mesh" aria-hidden>
          <span className="blob a" />
          <span className="blob b" />
          <span className="blob c" />
        </div>
        <Reveal>
          <h1 className="gradient-text">{home.heroTitle}</h1>
        </Reveal>
        <Reveal delay={130}>
          <p>{home.heroSubtitle}</p>
        </Reveal>
        {home.ctaText && (
          <Reveal delay={260}>
            <Link to={home.ctaLink || "/blog"} className="cta shine">
              {home.ctaText}
            </Link>
          </Reveal>
        )}
      </section>

      {home.cards.length > 0 && (
        <div className="rich-cards">
          {home.cards.map((card, i) => {
            const inner = (
              <>
                <span className="rich-card-icon">{card.icon}</span>
                <strong>{card.title}</strong>
                <span className="muted">{card.text}</span>
              </>
            );
            return (
              <Reveal key={i} delay={i * 100}>
                {card.link ? (
                  <Link className="rich-card" to={card.link}>
                    {inner}
                  </Link>
                ) : (
                  <div className="rich-card">{inner}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      )}

      {posts.length > 0 && (
        <>
          <h2 style={{ marginTop: "2.5rem" }}>{t("latestFromBlog")}</h2>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <p>
            <Link to="/blog">{t("allPosts")} →</Link>
          </p>
        </>
      )}
    </main>
  );
}
