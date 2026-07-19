import { Link } from "react-router-dom";
import type { PostSummary } from "../api";

export function PostCard({
  post,
  onTag,
}: {
  post: PostSummary;
  onTag?: (tag: string) => void;
}) {
  return (
    <article className={`card post-card ${post.coverImage ? "with-cover" : ""}`}>
      {post.coverImage && (
        <Link to={`/post/${post.slug}`}>
          <img className="cover" src={post.coverImage} alt="" />
        </Link>
      )}
      <div className="body">
        <h3>
          <Link to={`/post/${post.slug}`}>{post.title}</Link>
        </h3>
        <p style={{ margin: "0 0 0.6rem", color: "var(--text-2)" }}>{post.excerpt}</p>
        <span className="muted">
          {post.author ? `${post.author} · ` : ""}
          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}{" "}
        </span>
        {post.tags.map((tag) => (
          <span
            key={tag}
            className={`tag ${onTag ? "clickable" : ""}`}
            onClick={() => onTag?.(tag)}
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
