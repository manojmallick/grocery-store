import path from "node:path";
import express from "express";
import { media } from "./media.js";
import { api } from "./routes.js";
import { shop } from "./shop.js";
import { seo, spaWithMeta } from "./seo.js";

const app = express();
app.use("/api", media);
app.use(express.json({ limit: "2mb" }));
app.use("/api", api);
app.use("/api", shop);
app.use(seo); // robots.txt, sitemap.xml, feed.xml

// In production the built client is served statically; in dev, Vite serves the client
// on its own port and proxies /api here (see client dev config).
const clientDist = path.join(process.cwd(), "client", "dist");
app.use(express.static(clientDist, { index: false }));
app.get(/^\/(?!api\/).*/, spaWithMeta(clientDist));

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`FreshMart blog running on http://localhost:${port}`);
});
