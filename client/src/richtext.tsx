/**
 * Rich content renderer: Markdown plus fenced blocks (close each with ":::").
 *
 * Article blocks:
 *   :::video    YouTube / Vimeo URL or direct .mp4/.webm
 *   :::chart    {"type":"bar"|"line"|"pie","title","labels","values"}
 *   :::cards    - icon | title | text | optional-link
 *
 * Landing-page blocks:
 *   :::hero     title | subtitle | button text | button link   (one field per line)
 *   :::stats    - 120+ | Projects shipped        (numbers count up on scroll)
 *   :::cta      title | text | button text | button link
 *   :::quote    quote text | author | role
 *   :::gallery  one image URL per line
 *   :::columns  markdown, split into two columns by a line containing only "|||"
 *   :::faq      - question | answer
 *
 * Everything animates in on scroll (respects prefers-reduced-motion).
 */
import { marked } from "marked";
import { useState, type ReactNode } from "react";
import { Reveal, useCountUp } from "./motion";

type Segment =
  | { kind: "md"; text: string }
  | { kind: "video"; url: string }
  | { kind: "chart"; json: string }
  | { kind: "cards"; lines: string[] }
  | { kind: "hero"; lines: string[] }
  | { kind: "stats"; lines: string[] }
  | { kind: "cta"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "gallery"; lines: string[] }
  | { kind: "columns"; lines: string[] }
  | { kind: "faq"; lines: string[] };

const BLOCK_KINDS = [
  "video", "chart", "cards", "hero", "stats", "cta", "quote", "gallery", "columns", "faq",
] as const;

export function splitBlocks(content: string): Segment[] {
  const segments: Segment[] = [];
  const lines = content.split("\n");
  let buffer: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(new RegExp(`^:::(${BLOCK_KINDS.join("|")})\\s*$`));
    if (!match) {
      buffer.push(lines[i]);
      continue;
    }
    if (buffer.length) segments.push({ kind: "md", text: buffer.join("\n") });
    buffer = [];
    const body: string[] = [];
    i += 1;
    while (i < lines.length && lines[i].trim() !== ":::") {
      body.push(lines[i]);
      i += 1;
    }
    const kind = match[1] as (typeof BLOCK_KINDS)[number];
    if (kind === "video") segments.push({ kind, url: body.join("\n").trim() });
    else if (kind === "chart") segments.push({ kind, json: body.join("\n") });
    else segments.push({ kind, lines: body } as Segment);
  }
  if (buffer.length) segments.push({ kind: "md", text: buffer.join("\n") });
  return segments;
}

/* ---------------- article blocks ---------------- */

function embedUrl(url: string): { kind: "iframe" | "file"; src: string } | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg)(\?|$)/.test(url)) return { kind: "file", src: url };
  return null;
}

function Video({ url }: { url: string }) {
  const embed = embedUrl(url);
  if (!embed) return <p className="error">Unrecognized video URL: {url}</p>;
  if (embed.kind === "file") {
    return <video className="rich-video" src={embed.src} controls preload="metadata" />;
  }
  return (
    <div className="rich-video-frame">
      <iframe
        src={embed.src}
        title="Embedded video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

interface ChartSpec {
  type: "bar" | "line" | "pie";
  title?: string;
  labels: string[];
  values: number[];
}

const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0d9488", "#db2777"];

function Chart({ json }: { json: string }) {
  let spec: ChartSpec;
  try {
    spec = JSON.parse(json) as ChartSpec;
    if (!Array.isArray(spec.labels) || !Array.isArray(spec.values)) throw new Error();
  } catch {
    return <p className="error">Invalid chart JSON — expected {"{type, labels, values}"}</p>;
  }
  const width = 560;
  const height = 260;
  const pad = 36;
  const max = Math.max(...spec.values, 1);
  const n = spec.values.length;

  let body: ReactNode;
  if (spec.type === "pie") {
    const total = spec.values.reduce((a, b) => a + b, 0) || 1;
    const cx = 130;
    const cy = height / 2;
    const r = 95;
    let angle = -Math.PI / 2;
    const slices = spec.values.map((value, i) => {
      const start = angle;
      angle += (value / total) * Math.PI * 2;
      const large = angle - start > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      return (
        <path
          key={i}
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
          fill={PALETTE[i % PALETTE.length]}
        />
      );
    });
    body = (
      <>
        {slices}
        {spec.labels.map((label, i) => (
          <g key={label} transform={`translate(${270}, ${40 + i * 24})`}>
            <rect width="14" height="14" rx="3" fill={PALETTE[i % PALETTE.length]} />
            <text x="20" y="12" className="rich-chart-text">
              {label} — {spec.values[i]}
            </text>
          </g>
        ))}
      </>
    );
  } else if (spec.type === "line") {
    const step = (width - pad * 2) / Math.max(n - 1, 1);
    const points = spec.values
      .map((v, i) => `${pad + i * step},${height - pad - (v / max) * (height - pad * 2)}`)
      .join(" ");
    body = (
      <>
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="3" />
        {spec.values.map((v, i) => (
          <circle
            key={i}
            cx={pad + i * step}
            cy={height - pad - (v / max) * (height - pad * 2)}
            r="4"
            fill="var(--accent)"
          />
        ))}
        {spec.labels.map((label, i) => (
          <text key={label + i} x={pad + i * step} y={height - 12} textAnchor="middle" className="rich-chart-text">
            {label}
          </text>
        ))}
      </>
    );
  } else {
    const step = (width - pad * 2) / n;
    body = (
      <>
        {spec.values.map((v, i) => {
          const barHeight = (v / max) * (height - pad * 2);
          return (
            <g key={i}>
              <rect
                x={pad + i * step + step * 0.15}
                y={height - pad - barHeight}
                width={step * 0.7}
                height={barHeight}
                rx="4"
                fill={PALETTE[i % PALETTE.length]}
              />
              <text
                x={pad + i * step + step * 0.5}
                y={height - pad - barHeight - 6}
                textAnchor="middle"
                className="rich-chart-text"
              >
                {v}
              </text>
              <text
                x={pad + i * step + step * 0.5}
                y={height - 12}
                textAnchor="middle"
                className="rich-chart-text"
              >
                {spec.labels[i] ?? ""}
              </text>
            </g>
          );
        })}
      </>
    );
  }

  return (
    <figure className="rich-chart card">
      {spec.title && <figcaption>{spec.title}</figcaption>}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.title ?? "chart"}>
        {body}
      </svg>
    </figure>
  );
}

function parseRows(lines: string[]): string[][] {
  return lines
    .map((line) => line.replace(/^\s*-\s*/, ""))
    .filter(Boolean)
    .map((line) => line.split("|").map((s) => s.trim()));
}

function Cards({ lines }: { lines: string[] }) {
  const cards = parseRows(lines).map(([icon = "★", title = "", text = "", link = ""]) => ({
    icon, title, text, link,
  }));
  return (
    <div className="rich-cards">
      {cards.map((card, i) => {
        const inner = (
          <>
            <span className="rich-card-icon">{card.icon}</span>
            <strong>{card.title}</strong>
            <span className="muted">{card.text}</span>
          </>
        );
        return (
          <Reveal key={i} delay={i * 90}>
            {card.link ? (
              <a className="rich-card" href={card.link}>
                {inner}
              </a>
            ) : (
              <div className="rich-card">{inner}</div>
            )}
          </Reveal>
        );
      })}
    </div>
  );
}

/* ---------------- landing blocks ---------------- */

function BlockHero({ lines }: { lines: string[] }) {
  const [title = "", subtitle = "", ctaText = "", ctaLink = "#"] = lines
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <section className="block-hero">
      <div className="mesh" aria-hidden>
        <span className="blob a" />
        <span className="blob b" />
        <span className="blob c" />
      </div>
      <Reveal>
        <h1 className="gradient-text">{title}</h1>
      </Reveal>
      {subtitle && (
        <Reveal delay={120}>
          <p>{subtitle}</p>
        </Reveal>
      )}
      {ctaText && (
        <Reveal delay={240}>
          <a className="cta shine" href={ctaLink}>
            {ctaText}
          </a>
        </Reveal>
      )}
    </section>
  );
}

function Stat({ value, label, delay }: { value: string; label: string; delay: number }) {
  const [ref, shown] = useCountUp(value);
  return (
    <Reveal delay={delay} className="stat-cell">
      <span ref={ref} className="stat-value gradient-text">
        {shown}
      </span>
      <span className="stat-label">{label}</span>
    </Reveal>
  );
}

function BlockStats({ lines }: { lines: string[] }) {
  const stats = parseRows(lines).map(([value = "0", label = ""]) => ({ value, label }));
  return (
    <div className="block-stats">
      {stats.map((stat, i) => (
        <Stat key={i} value={stat.value} label={stat.label} delay={i * 100} />
      ))}
    </div>
  );
}

function BlockCta({ lines }: { lines: string[] }) {
  const [title = "", text = "", ctaText = "", ctaLink = "#"] = lines
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <Reveal>
      <section className="block-cta">
        <h2>{title}</h2>
        {text && <p>{text}</p>}
        {ctaText && (
          <a className="cta shine" href={ctaLink}>
            {ctaText}
          </a>
        )}
      </section>
    </Reveal>
  );
}

function BlockQuote({ lines }: { lines: string[] }) {
  const [quote = "", author = "", role = ""] = lines
    .join(" ")
    .split("|")
    .map((s) => s.trim());
  return (
    <Reveal>
      <figure className="block-quote">
        <blockquote>“{quote}”</blockquote>
        {author && (
          <figcaption>
            <span className="avatar">{author.charAt(0).toUpperCase()}</span>
            <span>
              <strong>{author}</strong>
              {role && <span className="muted"> · {role}</span>}
            </span>
          </figcaption>
        )}
      </figure>
    </Reveal>
  );
}

function BlockGallery({ lines }: { lines: string[] }) {
  const urls = lines.map((l) => l.trim()).filter(Boolean);
  return (
    <div className="block-gallery">
      {urls.map((url, i) => (
        <Reveal key={i} delay={i * 80}>
          <img src={url} alt="" loading="lazy" />
        </Reveal>
      ))}
    </div>
  );
}

function BlockColumns({ lines }: { lines: string[] }) {
  const text = lines.join("\n");
  const [left = "", right = ""] = text.split(/^\|\|\|$/m);
  return (
    <div className="block-columns">
      <Reveal>
        <div dangerouslySetInnerHTML={{ __html: marked.parse(left) }} />
      </Reveal>
      <Reveal delay={120}>
        <div dangerouslySetInnerHTML={{ __html: marked.parse(right) }} />
      </Reveal>
    </div>
  );
}

function FaqItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={delay}>
      <div className={`faq-item ${open ? "open" : ""}`}>
        <button className="faq-q" onClick={() => setOpen(!open)} aria-expanded={open}>
          {q}
          <span className="faq-chevron">▾</span>
        </button>
        <div className="faq-a" dangerouslySetInnerHTML={{ __html: marked.parse(a) }} />
      </div>
    </Reveal>
  );
}

function BlockFaq({ lines }: { lines: string[] }) {
  const items = parseRows(lines).map(([q = "", a = ""]) => ({ q, a }));
  return (
    <div className="block-faq">
      {items.map((item, i) => (
        <FaqItem key={i} q={item.q} a={item.a} delay={i * 70} />
      ))}
    </div>
  );
}

/* ---------------- renderer ---------------- */

export function RichText({ content }: { content: string }) {
  const segments = splitBlocks(content);
  return (
    <article className="prose">
      {segments.map((segment, i) => {
        switch (segment.kind) {
          case "md":
            return (
              <Reveal key={i}>
                <div dangerouslySetInnerHTML={{ __html: marked.parse(segment.text) }} />
              </Reveal>
            );
          case "video":
            return (
              <Reveal key={i}>
                <Video url={segment.url} />
              </Reveal>
            );
          case "chart":
            return (
              <Reveal key={i}>
                <Chart json={segment.json} />
              </Reveal>
            );
          case "cards":
            return <Cards key={i} lines={segment.lines} />;
          case "hero":
            return <BlockHero key={i} lines={segment.lines} />;
          case "stats":
            return <BlockStats key={i} lines={segment.lines} />;
          case "cta":
            return <BlockCta key={i} lines={segment.lines} />;
          case "quote":
            return <BlockQuote key={i} lines={segment.lines} />;
          case "gallery":
            return <BlockGallery key={i} lines={segment.lines} />;
          case "columns":
            return <BlockColumns key={i} lines={segment.lines} />;
          case "faq":
            return <BlockFaq key={i} lines={segment.lines} />;
        }
      })}
    </article>
  );
}
