import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  applyAccent,
  type HomeConfig,
  type Page,
  type Post,
  type Settings,
} from "../api";
import { euro, shopApi, type Order, type Product } from "../api";
import { LOCALE_NAMES } from "../i18n";
import { RichText } from "../richtext";

type Translations = NonNullable<Post["translations"]>;

type View =
  | { kind: "posts" }
  | { kind: "editPost"; post: Post | null }
  | { kind: "pages" }
  | { kind: "editPage"; page: Page | null }
  | { kind: "home" }
  | { kind: "settings" }
  | { kind: "products" }
  | { kind: "orders" };

export function AdminPage({ onChromeChange }: { onChromeChange: () => void }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [view, setView] = useState<View>({ kind: "posts" });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPosts(await api.adminPosts());
      const summaries = await api.pages();
      setPages(await Promise.all(summaries.map((s) => api.page(s.slug))));
      setSettings(await api.settings());
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (authed === null) {
    return (
      <main className="container">
        <p className="muted">Loading…</p>
      </main>
    );
  }
  if (!authed) return <Login onSuccess={refresh} />;

  return (
    <main className="container wide">
      <p style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button className={view.kind === "posts" ? "primary" : ""} onClick={() => setView({ kind: "posts" })}>
          Posts
        </button>
        <button className="primary" onClick={() => setView({ kind: "editPost", post: null })}>
          ＋ Post
        </button>
        <button className={view.kind === "pages" ? "primary" : ""} onClick={() => setView({ kind: "pages" })}>
          Pages
        </button>
        <button onClick={() => setView({ kind: "editPage", page: null })}>＋ Page</button>
        <button className={view.kind === "home" ? "primary" : ""} onClick={() => setView({ kind: "home" })}>
          Home builder
        </button>
        <button className={view.kind === "products" ? "primary" : ""} onClick={() => setView({ kind: "products" })}>
          🛒 Products
        </button>
        <button className={view.kind === "orders" ? "primary" : ""} onClick={() => setView({ kind: "orders" })}>
          📦 Orders
        </button>
        <button className={view.kind === "settings" ? "primary" : ""} onClick={() => setView({ kind: "settings" })}>
          Settings
        </button>
        <button
          style={{ marginLeft: "auto" }}
          onClick={async () => {
            await api.logout();
            setAuthed(false);
          }}
        >
          Log out
        </button>
      </p>
      {error && <p className="error">{error}</p>}

      {view.kind === "posts" && (
        <PostsTable
          posts={posts}
          onEdit={(post) => setView({ kind: "editPost", post })}
          onChanged={refresh}
          onError={setError}
        />
      )}
      {view.kind === "editPost" && settings && (
        <ContentEditor
          kind="post"
          initial={view.post}
          settings={settings}
          onDone={async () => {
            await refresh();
            setView({ kind: "posts" });
          }}
          onError={setError}
        />
      )}
      {view.kind === "pages" && (
        <PagesTable
          pages={pages}
          onEdit={(page) => setView({ kind: "editPage", page })}
          onChanged={async () => {
            await refresh();
            onChromeChange();
          }}
          onError={setError}
        />
      )}
      {view.kind === "editPage" && settings && (
        <ContentEditor
          kind="page"
          initial={view.page}
          settings={settings}
          onDone={async () => {
            await refresh();
            onChromeChange();
            setView({ kind: "pages" });
          }}
          onError={setError}
        />
      )}
      {view.kind === "home" && <HomeBuilder onError={setError} />}
      {view.kind === "products" && <ProductsAdmin onError={setError} />}
      {view.kind === "orders" && <OrdersAdmin onError={setError} />}
      {view.kind === "settings" && (
        <SettingsForm
          onSaved={async () => {
            await refresh();
            onChromeChange();
          }}
          onError={setError}
        />
      )}
    </main>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <h1>Admin</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.login(password);
            onSuccess();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
          }
        }}
      >
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <p>
          <button className="primary" type="submit">
            Log in
          </button>
        </p>
      </form>
    </main>
  );
}

function PostsTable({
  posts,
  onEdit,
  onChanged,
  onError,
}: {
  posts: Post[];
  onEdit: (post: Post) => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  async function act(fn: () => Promise<unknown>) {
    onError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <table className="admin">
      <thead>
        <tr>
          <th />
          <th>Title</th>
          <th>Status</th>
          <th>Updated</th>
          <th>Langs</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => (
          <tr key={post.id}>
            <td style={{ width: 92 }}>
              {post.coverImage ? (
                <img className="cover-thumb" src={post.coverImage} alt="" />
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td>
              <strong>
                {post.featured ? "★ " : ""}
                {post.title}
              </strong>
              <br />
              <span className="muted">/post/{post.slug}</span>
            </td>
            <td>
              <span className={post.status === "published" ? "badge-published" : "badge-draft"}>
                {post.status}
              </span>
            </td>
            <td className="muted">{new Date(post.updatedAt).toLocaleString()}</td>
            <td className="muted">
              {["default", ...Object.keys(post.translations ?? {})].join(", ")}
            </td>
            <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
              <button onClick={() => onEdit(post)}>Edit</button>{" "}
              <button
                onClick={() =>
                  act(() =>
                    api.updatePost(post.id, {
                      status: post.status === "published" ? "draft" : "published",
                    }),
                  )
                }
              >
                {post.status === "published" ? "Unpublish" : "Publish"}
              </button>{" "}
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Delete "${post.title}"?`)) act(() => api.deletePost(post.id));
                }}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
        {posts.length === 0 && (
          <tr>
            <td colSpan={6} className="muted">
              No posts yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function PagesTable({
  pages,
  onEdit,
  onChanged,
  onError,
}: {
  pages: Page[];
  onEdit: (page: Page) => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  return (
    <table className="admin">
      <thead>
        <tr>
          <th>Title</th>
          <th>URL</th>
          <th>In nav</th>
          <th>Langs</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {pages.map((page) => (
          <tr key={page.id}>
            <td>
              <strong>{page.title}</strong>
            </td>
            <td className="muted">/p/{page.slug}</td>
            <td>{page.showInNav ? "✓" : "—"}</td>
            <td className="muted">
              {["default", ...Object.keys(page.translations ?? {})].join(", ")}
            </td>
            <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
              <button onClick={() => onEdit(page)}>Edit</button>{" "}
              <button
                className="danger"
                onClick={async () => {
                  if (!confirm(`Delete page "${page.title}"?`)) return;
                  onError(null);
                  try {
                    await api.deletePage(page.id);
                    onChanged();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : "Delete failed");
                  }
                }}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
        {pages.length === 0 && (
          <tr>
            <td colSpan={5} className="muted">
              No pages yet — create an About or Contact page.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const BLOCK_SNIPPETS: { label: string; snippet: string }[] = [
  { label: "🎬 Hero", snippet: ":::hero\nYour headline here\nA subtitle that sells the story\nGet started\n/blog\n:::" },
  { label: "🔢 Stats", snippet: ":::stats\n- 120+ | Projects shipped\n- 4.9 | Average rating\n- 12k | Happy readers\n:::" },
  { label: "🃏 Cards", snippet: ":::cards\n- 🚀 | Fast | Why it matters | /optional/link\n- 🎨 | Beautiful | Second card\n- 🔒 | Secure | Third card\n:::" },
  { label: "📣 CTA", snippet: ":::cta\nReady to dive in?\nOne sentence of encouragement.\nStart now\n/p/about\n:::" },
  { label: "💬 Quote", snippet: ":::quote\nThis changed how we publish. | Jane Doe | Editor-in-chief\n:::" },
  { label: "🖼️ Gallery", snippet: ":::gallery\n/api/media/your-image.png\n/api/media/another.png\n:::" },
  { label: "🏛️ Columns", snippet: ":::columns\n## Left side\nMarkdown here.\n|||\n## Right side\nMore markdown.\n:::" },
  { label: "❓ FAQ", snippet: ":::faq\n- How does it work? | Write blocks, hit publish.\n- Is it customizable? | Every pixel is your code.\n:::" },
  { label: "▶️ Video", snippet: ":::video\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n:::" },
  { label: "📊 Chart", snippet: ':::chart\n{"type":"bar","title":"Visitors","labels":["Mon","Tue","Wed"],"values":[120,200,150]}\n:::' },
];

const BLOCK_HELP = `Blocks animate in on scroll. Click a chip above to insert one at the cursor; close each with ::: on its own line.`;

function ContentEditor({
  kind,
  initial,
  settings,
  onDone,
  onError,
}: {
  kind: "post" | "page";
  initial: Post | Page | null;
  settings: Settings;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const post = kind === "post" ? (initial as Post | null) : null;
  const page = kind === "page" ? (initial as Page | null) : null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [tags, setTags] = useState(post?.tags.join(", ") ?? "");
  const [author, setAuthor] = useState(post?.author ?? "");
  const [featured, setFeatured] = useState(post?.featured ?? false);
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [metaDescription, setMetaDescription] = useState(initial?.metaDescription ?? "");
  const [showInNav, setShowInNav] = useState(page?.showInNav ?? true);
  const [content, setContent] = useState(initial?.content ?? "");
  const [translations, setTranslations] = useState<Translations>(initial?.translations ?? {});
  const [editLocale, setEditLocale] = useState(""); // "" = default locale
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const otherLocales = settings.locales.filter((l) => l !== settings.defaultLocale);
  const tr = editLocale ? (translations[editLocale] ?? {}) : null;

  const currentTitle = tr ? (tr.title ?? "") : title;
  const currentContent = tr ? (tr.content ?? "") : content;
  const currentMeta = tr ? (tr.metaDescription ?? "") : metaDescription;

  const setField = (field: "title" | "content" | "metaDescription", value: string) => {
    if (!editLocale) {
      if (field === "title") setTitle(value);
      else if (field === "content") setContent(value);
      else setMetaDescription(value);
      return;
    }
    setTranslations({
      ...translations,
      [editLocale]: { ...translations[editLocale], [field]: value },
    });
  };

  async function uploadInline(file: File) {
    setBusy(true);
    onError(null);
    try {
      const { url } = await api.uploadImage(file);
      const snippet = `\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`;
      const el = textRef.current;
      const at = el?.selectionStart ?? currentContent.length;
      setField("content", currentContent.slice(0, at) + snippet + currentContent.slice(at));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(file: File) {
    setBusy(true);
    onError(null);
    try {
      const { url } = await api.uploadImage(file);
      setCoverImage(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(status?: "draft" | "published") {
    setBusy(true);
    onError(null);
    try {
      if (kind === "post") {
        const body = {
          title,
          slug,
          content,
          metaDescription,
          coverImage,
          author,
          featured,
          translations,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          status,
        };
        if (post) await api.updatePost(post.id, body);
        else await api.createPost(body);
      } else {
        const body = { title, slug, content, metaDescription, coverImage, showInNav, translations };
        if (page) await api.updatePage(page.id, body);
        else await api.createPage(body);
      }
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <div>
      {otherLocales.length > 0 && (
        <p style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: 0 }}>
          <span
            className={`tag clickable ${editLocale === "" ? "active" : ""}`}
            onClick={() => setEditLocale("")}
          >
            {LOCALE_NAMES[settings.defaultLocale] ?? settings.defaultLocale} (default)
          </span>
          {otherLocales.map((locale) => (
            <span
              key={locale}
              className={`tag clickable ${editLocale === locale ? "active" : ""}`}
              onClick={() => setEditLocale(locale)}
            >
              {LOCALE_NAMES[locale] ?? locale}
              {translations[locale]?.title || translations[locale]?.content ? " ✓" : ""}
            </span>
          ))}
        </p>
      )}

      <label htmlFor="title">Title{editLocale ? ` (${editLocale})` : ""}</label>
      <input id="title" value={currentTitle} onChange={(e) => setField("title", e.target.value)} />

      {!editLocale && (
        <>
          <div className="split">
            <div>
              <label htmlFor="slug">Slug (optional — derived from title)</label>
              <input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div>
              {kind === "post" ? (
                <>
                  <label htmlFor="tags">Tags (comma-separated)</label>
                  <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
                </>
              ) : (
                <>
                  <label htmlFor="nav">Navigation</label>
                  <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: 0 }}>
                    <input
                      id="nav"
                      type="checkbox"
                      checked={showInNav}
                      onChange={(e) => setShowInNav(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    Show in header navigation
                  </label>
                </>
              )}
            </div>
          </div>

          {kind === "post" && (
            <div className="split">
              <div>
                <label htmlFor="author">Author (defaults to “{settings.defaultAuthor}”)</label>
                <input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
              <div>
                <label>Featured</label>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  ★ Show as the featured banner on Home and Blog
                </label>
              </div>
            </div>
          )}

          <label>Cover image (card thumbnail, hero, and og:image)</label>
          <p style={{ display: "flex", gap: "0.75rem", alignItems: "center", margin: "0.25rem 0" }}>
            {coverImage ? (
              <img className="cover-thumb" src={coverImage} alt="" style={{ width: 120, height: 72 }} />
            ) : (
              <span className="muted">None</span>
            )}
            <button type="button" disabled={busy} onClick={() => coverRef.current?.click()}>
              {coverImage ? "Replace" : "📷 Upload cover"}
            </button>
            {coverImage && (
              <button type="button" onClick={() => setCoverImage("")}>
                Remove
              </button>
            )}
            <input
              ref={coverRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadCover(file);
                e.target.value = "";
              }}
            />
          </p>
        </>
      )}

      <label htmlFor="metaDescription">
        SEO description{editLocale ? ` (${editLocale})` : ""} — meta/OG tags, defaults to excerpt
      </label>
      <input
        id="metaDescription"
        value={currentMeta}
        onChange={(e) => setField("metaDescription", e.target.value)}
        maxLength={160}
        placeholder="Up to 160 characters shown in search results and link previews"
      />

      <div className="palette">
        {BLOCK_SNIPPETS.map((block) => (
          <button
            key={block.label}
            type="button"
            onClick={() => {
              const el = textRef.current;
              const at = el?.selectionStart ?? currentContent.length;
              setField(
                "content",
                `${currentContent.slice(0, at)}\n${block.snippet}\n${currentContent.slice(at)}`,
              );
            }}
          >
            {block.label}
          </button>
        ))}
      </div>
      <div className="split">
        <div>
          <label htmlFor="content" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              Content{editLocale ? ` (${editLocale})` : ""} — Markdown + rich blocks
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => imageRef.current?.click()}
              style={{ padding: "0.15rem 0.6rem", fontSize: "0.78rem" }}
            >
              📷 Upload image
            </button>
          </label>
          <input
            ref={imageRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadInline(file);
              e.target.value = "";
            }}
          />
          <textarea
            ref={textRef}
            id="content"
            className="editor"
            value={currentContent}
            onChange={(e) => setField("content", e.target.value)}
            placeholder={editLocale ? "Leave empty to fall back to the default language" : ""}
          />
          <p className="muted" style={{ whiteSpace: "pre-line", fontSize: "0.75rem" }}>
            {BLOCK_HELP}
          </p>
        </div>
        <div>
          <label>Preview</label>
          <div className="card" style={{ minHeight: 340 }}>
            <RichText content={currentContent || content || "*Nothing yet*"} />
          </div>
        </div>
      </div>

      <p style={{ display: "flex", gap: "0.6rem" }}>
        {kind === "post" ? (
          <>
            <button className="primary" disabled={busy || !title.trim()} onClick={() => save("published")}>
              Publish
            </button>
            <button disabled={busy || !title.trim()} onClick={() => save("draft")}>
              Save draft
            </button>
          </>
        ) : (
          <button className="primary" disabled={busy || !title.trim()} onClick={() => save()}>
            Save page
          </button>
        )}
      </p>
    </div>
  );
}

function HomeBuilder({ onError }: { onError: (message: string | null) => void }) {
  const [home, setHome] = useState<HomeConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.home().then(setHome).catch(() => {});
  }, []);

  if (!home) return <p className="muted">Loading…</p>;

  const setCard = (i: number, key: "icon" | "title" | "text" | "link", value: string) => {
    const cards = home.cards.map((c, j) => (j === i ? { ...c, [key]: value } : c));
    setHome({ ...home, cards });
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Hero</h2>
      <div className="split">
        <div>
          <label>Hero title</label>
          <input value={home.heroTitle} onChange={(e) => setHome({ ...home, heroTitle: e.target.value })} />
          <label>Hero subtitle</label>
          <input
            value={home.heroSubtitle}
            onChange={(e) => setHome({ ...home, heroSubtitle: e.target.value })}
          />
        </div>
        <div>
          <label>Button text</label>
          <input value={home.ctaText} onChange={(e) => setHome({ ...home, ctaText: e.target.value })} />
          <label>Button link</label>
          <input value={home.ctaLink} onChange={(e) => setHome({ ...home, ctaLink: e.target.value })} />
        </div>
      </div>

      <h2>Cards</h2>
      <table className="admin">
        <thead>
          <tr>
            <th style={{ width: "4rem" }}>Icon</th>
            <th>Title</th>
            <th>Text</th>
            <th>Link</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {home.cards.map((card, i) => (
            <tr key={i}>
              <td>
                <input value={card.icon} onChange={(e) => setCard(i, "icon", e.target.value)} />
              </td>
              <td>
                <input value={card.title} onChange={(e) => setCard(i, "title", e.target.value)} />
              </td>
              <td>
                <input value={card.text} onChange={(e) => setCard(i, "text", e.target.value)} />
              </td>
              <td>
                <input
                  value={card.link ?? ""}
                  placeholder="/blog, /p/about, https://…"
                  onChange={(e) => setCard(i, "link", e.target.value)}
                />
              </td>
              <td>
                <button
                  className="danger"
                  onClick={() => setHome({ ...home, cards: home.cards.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <button
          onClick={() =>
            setHome({ ...home, cards: [...home.cards, { icon: "★", title: "", text: "", link: "" }] })
          }
        >
          ＋ Add card
        </button>
      </p>

      <p>
        <button
          className="primary"
          onClick={async () => {
            onError(null);
            try {
              setHome(await api.saveHome(home));
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            } catch (err) {
              onError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        >
          {saved ? "Saved ✓" : "Save home page"}
        </button>
      </p>
    </div>
  );
}

function SettingsForm({
  onSaved,
  onError,
}: {
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [localesText, setLocalesText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((s) => {
        setSettings(s);
        setLocalesText(s.locales.join(", "));
      })
      .catch(() => {});
  }, []);

  if (!settings) return <p className="muted">Loading…</p>;

  const set = (key: "siteTitle" | "tagline" | "accentColor" | "footerText" | "siteUrl" | "defaultAuthor") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings({ ...settings, [key]: e.target.value });

  return (
    <div style={{ maxWidth: 520 }}>
      <label>Site title</label>
      <input value={settings.siteTitle} onChange={set("siteTitle")} />
      <label>Tagline (also the default SEO description)</label>
      <input value={settings.tagline} onChange={set("tagline")} />
      <label>Site URL (canonical links, sitemap, RSS, hreflang)</label>
      <input value={settings.siteUrl} onChange={set("siteUrl")} placeholder="https://example.com" />
      <label>Default author byline</label>
      <input value={settings.defaultAuthor} onChange={set("defaultAuthor")} />
      <div className="split">
        <div>
          <label>Languages (comma-separated codes, e.g. en, nl, hi)</label>
          <input
            value={localesText}
            onChange={(e) => setLocalesText(e.target.value)}
            placeholder="en, es, fr"
          />
        </div>
        <div>
          <label>Default language</label>
          <select
            value={settings.defaultLocale}
            onChange={(e) => setSettings({ ...settings, defaultLocale: e.target.value })}
          >
            {localesText
              .split(",")
              .map((l) => l.trim().toLowerCase())
              .filter(Boolean)
              .map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_NAMES[locale] ?? locale}
                </option>
              ))}
          </select>
        </div>
      </div>
      <label>Accent color</label>
      <input type="color" value={settings.accentColor} onChange={set("accentColor")} />
      <label>Footer text</label>
      <input value={settings.footerText} onChange={set("footerText")} />
      <p>
        <button
          className="primary"
          onClick={async () => {
            onError(null);
            try {
              const locales = localesText
                .split(",")
                .map((l) => l.trim().toLowerCase())
                .filter(Boolean);
              const next = await api.saveSettings({ ...settings, locales });
              setSettings(next);
              setLocalesText(next.locales.join(", "));
              applyAccent(next.accentColor);
              document.title = next.siteTitle;
              onSaved();
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            } catch (err) {
              onError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        >
          {saved ? "Saved ✓" : "Save settings"}
        </button>
      </p>
    </div>
  );
}

/* ---------------- store admin ---------------- */

const EMPTY_PRODUCT: Partial<Product> = {
  name: "", category: "Fruits", unit: "each", price: 100, stock: 20, description: "", active: true, featured: false,
};

function ProductsAdmin({ onError }: { onError: (m: string | null) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setProducts(await shopApi.adminProducts());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load products");
    }
  }, [onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    onError(null);
    try {
      if (editing.id) await shopApi.updateProduct(editing.id, editing);
      else await shopApi.createProduct(editing);
      setEditing(null);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const { url } = await api.uploadImage(file);
      setEditing((prev) => ({ ...prev, image: url }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        <button className="primary" onClick={() => setEditing({ ...EMPTY_PRODUCT })}>
          ＋ New product
        </button>
      </p>

      {editing && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{editing.id ? "Edit product" : "New product"}</h2>
          <div className="split">
            <div>
              <label>Name</label>
              <input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <label>Description</label>
              <input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <div className="split">
                <div>
                  <label>Category</label>
                  <input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </div>
                <div>
                  <label>Unit (each, 500 g, 1 L…)</label>
                  <input value={editing.unit ?? ""} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <div className="split">
                <div>
                  <label>Price (cents)</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.price ?? 0}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                  <span className="muted">= {euro(editing.price ?? 0)}</span>
                </div>
                <div>
                  <label>Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.stock ?? 0}
                    onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                  />
                </div>
              </div>
              <label>Photo</label>
              <p style={{ display: "flex", gap: "0.6rem", alignItems: "center", margin: "0.25rem 0" }}>
                {editing.image ? <img className="cover-thumb" src={editing.image} alt="" /> : <span className="muted">None</span>}
                <button type="button" disabled={busy} onClick={() => imgRef.current?.click()}>
                  📷 Upload
                </button>
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                    e.target.value = "";
                  }}
                />
              </p>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={editing.active !== false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active (visible in store)
              </label>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={editing.featured === true}
                  onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                />
                ★ Popular badge
              </label>
            </div>
          </div>
          <p style={{ display: "flex", gap: "0.6rem", marginBottom: 0 }}>
            <button className="primary" disabled={busy || !(editing.name ?? "").trim()} onClick={save}>
              Save product
            </button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </p>
        </div>
      )}

      <table className="admin">
        <thead>
          <tr>
            <th />
            <th>Product</th>
            <th>Category</th>
            <th className="num">Price</th>
            <th className="num">Stock</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td style={{ width: 64 }}>
                {product.image ? <img className="cover-thumb" style={{ width: 56, height: 40 }} src={product.image} alt="" /> : "—"}
              </td>
              <td>
                <strong>{product.featured ? "★ " : ""}{product.name}</strong>
                <br />
                <span className="muted">{product.unit}</span>
              </td>
              <td>{product.category}</td>
              <td className="num">{euro(product.price)}</td>
              <td className="num">{product.stock}</td>
              <td>
                <span className={product.active ? "badge-published" : "badge-draft"}>
                  {product.active ? "active" : "hidden"}
                </span>
              </td>
              <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                <button onClick={() => setEditing(product)}>Edit</button>{" "}
                <button
                  className="danger"
                  onClick={async () => {
                    if (!confirm(`Delete "${product.name}"?`)) return;
                    await shopApi.deleteProduct(product.id).catch(() => {});
                    refresh();
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">No products yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_FLOW: Order["status"][] = ["new", "confirmed", "out-for-delivery", "delivered", "cancelled"];

function OrdersAdmin({ onError }: { onError: (m: string | null) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);

  const refresh = useCallback(async () => {
    try {
      setOrders(await shopApi.adminOrders());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load orders");
    }
  }, [onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <table className="admin">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Items</th>
          <th className="num">Total</th>
          <th>Window</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>
              <strong>{order.number}</strong>
              <br />
              <span className="muted">{new Date(order.createdAt).toLocaleString()}</span>
            </td>
            <td>
              {order.customer.name}
              <br />
              <span className="muted">{order.customer.address}, {order.customer.city}</span>
            </td>
            <td className="muted">
              {order.items.map((item) => `${item.qty}× ${item.name}`).join(", ")}
            </td>
            <td className="num">{euro(order.total)}</td>
            <td className="muted">{order.deliveryWindow}</td>
            <td>
              <select
                value={order.status}
                onChange={async (e) => {
                  await shopApi.setOrderStatus(order.id, e.target.value as Order["status"]).catch(() => {});
                  refresh();
                }}
                style={{ width: "auto" }}
              >
                {STATUS_FLOW.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
        {orders.length === 0 && (
          <tr>
            <td colSpan={6} className="muted">No orders yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
