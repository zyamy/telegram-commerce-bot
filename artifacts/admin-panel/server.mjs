// Static file server with /api/* proxy to api-server.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "dist/public");
const PORT = Number(process.env.PORT ?? 3000);
const API_URL = process.env.API_URL;

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

async function proxyApi(req, res) {
  if (!API_URL) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "API_URL not configured" }));
    return;
  }
  try {
    const target = API_URL.replace(/\/$/, "") + req.url;
    const headers = { ...req.headers };
    delete headers.host;
    delete headers["content-length"];
    const init = { method: req.method, headers };
    if (!["GET", "HEAD"].includes(req.method)) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      if (chunks.length) init.body = Buffer.concat(chunks);
    }
    const upstream = await fetch(target, init);
    const outHeaders = {};
    upstream.headers.forEach((v, k) => {
      if (!["content-encoding", "transfer-encoding", "content-length"].includes(k.toLowerCase())) {
        outHeaders[k] = v;
      }
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, outHeaders);
    res.end(buf);
  } catch (err) {
    console.error("Proxy error:", err);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Bad gateway", detail: String(err) }));
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = req.url ?? "/";

    if (url.startsWith("/api/")) {
      await proxyApi(req, res);
      return;
    }

    const path = decodeURIComponent(url.split("?")[0]);
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(ROOT, safe);
    if (!filePath.startsWith(ROOT)) filePath = ROOT;

    try {
      const s = await stat(filePath);
      if (s.isDirectory()) filePath = join(filePath, "index.html");
      await send(res, filePath);
    } catch {
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
  console.log(`API proxy: ${API_URL ? `→ ${API_URL}` : "DISABLED (set API_URL env)"}`);
});
