import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "dist/public");
const PORT = Number(process.env.PORT ?? 3000);
const API_URL = process.env.API_URL; // <-- baru

const MIME = { /* ... biar sama macam asal ... */ };

async function send(res, filePath, status = 200) { /* ... sama ... */ }

const server = createServer(async (req, res) => {
  try {
    const url = req.url ?? "/";

    // Proxy /api/* ke api-server
    if (url.startsWith("/api/") && API_URL) {
      const target = API_URL.replace(/\/$/, "") + url;
      const init = {
        method: req.method,
        headers: { ...req.headers, host: new URL(API_URL).host },
      };
      if (!["GET", "HEAD"].includes(req.method)) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        init.body = Buffer.concat(chunks);
      }
      const upstream = await fetch(target, init);
      res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
      return;
    }

    // ... rest static serving sama macam asal
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
});
