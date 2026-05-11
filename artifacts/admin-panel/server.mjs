// Minimal zero-dependency static file server for the built admin panel.
// Serves files from dist/public with SPA fallback to index.html.
// Used in production (Railway). For local dev use `pnpm run dev`.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "dist/public");
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

async function send(res, filePath, status = 200) {
  const body = await readFile(filePath);
  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(status, {
    "content-type": type,
    "cache-control": filePath.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const safe = normalize(url).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(ROOT, safe);
    if (!filePath.startsWith(ROOT)) filePath = ROOT;

    try {
      const s = await stat(filePath);
      if (s.isDirectory()) filePath = join(filePath, "index.html");
      await send(res, filePath);
    } catch {
      // SPA fallback
      await send(res, join(ROOT, "index.html"));
    }
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
    console.error(err);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`admin-panel listening on http://0.0.0.0:${PORT}`);
});
