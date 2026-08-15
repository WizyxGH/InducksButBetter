/**
 * Local image proxy — development only, never deployed.
 *
 * Inducks sits behind Anubis, which challenges clients with a proof of work and
 * hands back a clearance cookie. This relays *your own* cookie from your own
 * machine so images render while you browse locally. It solves no challenge and
 * holds no session but yours: paste the cookie once into `.env.local` and it is
 * forwarded verbatim.
 *
 *   INDUCKS_COOKIE="techaro.lol-anubis-auth=..."
 *
 * Responses are cached on disk, so revisiting a page costs Inducks nothing.
 *
 *   node scripts/image-proxy.mjs        (or: pnpm dev:images)
 *
 * The deployed site has no such backend by design — see src/lib/imageProxy.ts,
 * which stops the frontend from emitting these requests in production.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const PORT = Number(process.env.IMAGE_PROXY_PORT || 3000);
const CACHE_DIR = path.resolve(import.meta.dirname, "..", ".image-cache");

// Only these hosts are ever contacted, whatever the caller passes in `url`.
const ALLOWED_HOSTS = new Set(["inducks.org", "www.inducks.org", "outducks.org"]);

/** Reads INDUCKS_COOKIE from the environment or a local .env file. */
async function readCookie() {
  if (process.env.INDUCKS_COOKIE) return process.env.INDUCKS_COOKIE;
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await fs.readFile(path.resolve(import.meta.dirname, "..", file), "utf8");
      const line = text.split(/\r?\n/).find((l) => l.trim().startsWith("INDUCKS_COOKIE="));
      if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    } catch {
      // File absent — try the next one.
    }
  }
  return "";
}

await fs.mkdir(CACHE_DIR, { recursive: true });

/**
 * The clearance cookie is short-lived, so it is read fresh on every request
 * rather than captured at startup: pasting a new one takes effect immediately,
 * with no restart. `POST /api/cookie` writes it here without touching the file
 * by hand.
 */
let cookieOverride = "";
const currentCookie = async () => cookieOverride || (await readCookie());

if (!(await currentCookie())) {
  console.warn(
    "\n  No INDUCKS_COOKIE yet. Requests would go out anonymously and Anubis\n" +
    "  answers 403. Paste one at http://127.0.0.1:" + PORT + "/  — or put it in\n" +
    '  .env.local as INDUCKS_COOKIE="..." (picked up on the next request).\n'
  );
}

/** Minimal paste form, so refreshing the cookie is one copy and one click. */
const PASTE_PAGE = `<!doctype html><meta charset="utf-8"><title>Cookie Inducks</title>
<style>body{font-family:system-ui;max-width:640px;margin:60px auto;padding:0 20px;
background:#14141b;color:#e8e8ef;line-height:1.6}textarea{width:100%;height:110px;
background:#1c1c26;color:#e8e8ef;border:1px solid #3a3a4a;border-radius:10px;padding:10px;
font-family:monospace;font-size:12px}button{font:inherit;margin-top:12px;padding:10px 18px;
border-radius:10px;border:0;background:#2563eb;color:#fff;cursor:pointer}
code{background:#000;padding:2px 6px;border-radius:4px}#s{margin-top:14px}</style>
<h2>Cookie de laissez-passer Inducks</h2>
<p>Sur inducks.org, devtools → <b>Réseau</b> → une requête → <b>En-têtes de requête</b> →
ligne <code>Cookie</code>. Colle la valeur entière ci-dessous.</p>
<textarea id="c" placeholder="techaro.lol-anubis-auth=..."></textarea>
<button onclick="save()">Enregistrer</button><div id="s"></div>
<script>
async function save(){
  const r = await fetch('/api/cookie',{method:'POST',body:document.getElementById('c').value});
  document.getElementById('s').textContent = r.ok
    ? '✅ Enregistré. Recharge InducksButBetter, aucun redémarrage nécessaire.'
    : '❌ ' + await r.text();
}
</script>`;

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname === "/cookie")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(PASTE_PAGE);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/cookie") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const value = Buffer.concat(chunks).toString("utf8").trim();
    if (!value) {
      res.writeHead(400).end("Empty cookie");
      return;
    }
    cookieOverride = value;
    // A fresh cookie usually means the old one was rejected, so drop the
    // failures it produced — successes are images and stay valid.
    console.log(`  Cookie updated (${value.length} chars)`);
    res.writeHead(204).end();
    return;
  }

  if (requestUrl.pathname !== "/api/proxy-image") {
    res.writeHead(404).end("Not found");
    return;
  }

  const target = requestUrl.searchParams.get("url");
  if (!target) {
    res.writeHead(400).end("Missing url parameter");
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.writeHead(400).end("Malformed url parameter");
    return;
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    // Without this the proxy would happily fetch anything, including hosts on
    // the local network — an open relay listening on localhost.
    res.writeHead(403).end(`Host not allowed: ${parsed.hostname}`);
    return;
  }

  const key = crypto.createHash("sha256").update(parsed.href).digest("hex");
  const cached = path.join(CACHE_DIR, key);

  try {
    const [body, type] = await Promise.all([
      fs.readFile(cached),
      fs.readFile(`${cached}.type`, "utf8").catch(() => "image/jpeg"),
    ]);
    res.writeHead(200, { 
      "Content-Type": type, 
      "X-Proxy-Cache": "hit",
      "Cache-Control": "public, max-age=31536000, immutable" 
    }).end(body);
    return;
  } catch {
    // Not cached yet — fetch it below.
  }

  try {
    const cookie = await currentCookie();
    const upstream = await fetch(parsed.href, {
      headers: {
        // A browser's headers, because that is what this is standing in for.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://inducks.org/",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });

    const type = upstream.headers.get("content-type") || "";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    if (!upstream.ok || !type.startsWith("image/")) {
      // Anubis answers 200 with an HTML challenge page as readily as it answers
      // 403, so the content type is what actually distinguishes success here.
      const hint = type.includes("html") ? " (Anubis challenge or error page — refresh your cookie)" : "";
      console.warn(`  ${upstream.status} ${parsed.pathname}${hint}`);
      res.writeHead(502, { "Content-Type": "text/plain" }).end(`Upstream ${upstream.status}${hint}`);
      return;
    }

    await Promise.all([
      fs.writeFile(cached, buffer),
      fs.writeFile(`${cached}.type`, type),
    ]);

    res.writeHead(200, { 
      "Content-Type": type, 
      "X-Proxy-Cache": "miss",
      "Cache-Control": "public, max-age=31536000, immutable"
    }).end(buffer);
  } catch (err) {
    console.warn(`  fetch failed: ${err.message}`);
    res.writeHead(502, { "Content-Type": "text/plain" }).end(`Fetch failed: ${err.message}`);
  }
});

// Loopback only: this holds your session, it has no business on the network.
server.listen(PORT, "127.0.0.1", async () => {
  console.log(`  Image proxy on http://127.0.0.1:${PORT}  (cache: .image-cache)`);
  console.log(`  Cookie: ${(await currentCookie()) ? "loaded" : "none yet — paste one in Settings"}`);
});
