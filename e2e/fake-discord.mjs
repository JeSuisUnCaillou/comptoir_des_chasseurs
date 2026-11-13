// A fake Discord for the e2e tests: its sign-in page lets the test say who it
// is on Discord, and its API answers like Discord's for that account.
// Started by playwright.config.ts; the app reaches it through DISCORD_AUTHORIZE_URL
// and DISCORD_API_URL.
import { createServer } from "node:http";

const FAKE_DISCORD_PORT = 3999;
const FAKE_DISCORD_CLIENT = { id: "comptoir-e2e", secret: "comptoir-e2e-secret" };

const encode = (user) => Buffer.from(JSON.stringify(user)).toString("base64url");
const decode = (token) => JSON.parse(Buffer.from(token, "base64url").toString());
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function body(request) {
  let data = "";
  for await (const chunk of request) data += chunk;
  return new URLSearchParams(data);
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${FAKE_DISCORD_PORT}`);
  const send = (status, type, content) => {
    response.writeHead(status, { "Content-Type": type });
    response.end(content);
  };
  const json = (status, value) => send(status, "application/json", JSON.stringify(value));

  if (url.pathname === "/health") return send(200, "text/plain", "ok");

  if (url.pathname === "/oauth2/authorize") {
    const q = url.searchParams;
    if (q.get("client_id") !== FAKE_DISCORD_CLIENT.id || q.get("scope") !== "identify") {
      return send(400, "text/plain", "client_id ou scope inattendu");
    }
    const hidden = ["redirect_uri", "state"]
      .map((name) => `<input type="hidden" name="${name}" value="${escape(q.get(name) ?? "")}">`)
      .join("");
    return send(
      200,
      "text/html; charset=utf-8",
      `<!doctype html><title>Faux Discord</title><h1>Faux Discord</h1>
      <form action="/oauth2/approve">${hidden}
        <label>Identifiant Discord <input name="id"></label>
        <label>Nom Discord <input name="name"></label>
        <button>Autoriser</button>
        <button name="cancel" value="1">Annuler</button>
      </form>`,
    );
  }

  if (url.pathname === "/oauth2/approve") {
    const q = url.searchParams;
    const back = new URL(q.get("redirect_uri"));
    back.searchParams.set("state", q.get("state"));
    if (q.get("cancel")) back.searchParams.set("error", "access_denied");
    else back.searchParams.set("code", encode({ id: q.get("id"), name: q.get("name"), redirect: q.get("redirect_uri") }));
    response.writeHead(302, { Location: back.toString() });
    return response.end();
  }

  if (url.pathname === "/api/oauth2/token" && request.method === "POST") {
    const form = await body(request);
    if (form.get("client_id") !== FAKE_DISCORD_CLIENT.id || form.get("client_secret") !== FAKE_DISCORD_CLIENT.secret) {
      return json(401, { error: "invalid_client" });
    }
    const code = form.get("code") ?? "";
    try {
      if (decode(code).redirect !== form.get("redirect_uri")) return json(400, { error: "invalid_grant" });
    } catch {
      return json(400, { error: "invalid_grant" });
    }
    return json(200, { access_token: code, token_type: "Bearer" });
  }

  if (url.pathname === "/api/users/@me") {
    try {
      const { id, name } = decode((request.headers.authorization ?? "").replace(/^Bearer /, ""));
      return json(200, { id, username: name.toLowerCase(), global_name: name });
    } catch {
      return json(401, { message: "401: Unauthorized" });
    }
  }

  send(404, "text/plain", "not found");
}).listen(FAKE_DISCORD_PORT);
