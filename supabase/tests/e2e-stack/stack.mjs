// LOCAL EMULATION of the Supabase pieces NutriPalm uses -- for browser E2E only.
//
//   * Postgres: PGlite (real PostgreSQL 17) with the repo's migrations 001..N applied
//   * Auth:     GoTrue-compatible subset  (/auth/v1/signup, /token, /user, /logout)
//   * Data:     PostgREST-compatible subset (/rest/v1/<table>) -- every request runs inside a
//               transaction as the JWT's role (anon / authenticated / service_role) with
//               request.jwt.claims set, so Postgres RLS is what enforces isolation.
//
// THIS IS NOT SUPABASE. It cannot prove anything about a managed project (GoTrue behaviour,
// PostgREST edge cases, grants, email confirmation, OAuth). It exists so the real frontend and
// the real FastAPI backend can be exercised end to end without external infrastructure.

import http from "node:http";
import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "..", "migrations");

// ----------------------------------------------------------------- JWT (HS256)
const b64u = (b) => Buffer.from(b).toString("base64url");
export function signJwt(payload, secret) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token, secret) {
  const [h, b, s] = String(token).split(".");
  if (!h || !b || !s) throw new Error("malformed");
  const expect = crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expect))) throw new Error("bad signature");
  const claims = JSON.parse(Buffer.from(b, "base64url").toString());
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) throw new Error("JWT expired");
  return claims;
}

// ---------------------------------------------------------------- SQL helpers
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw httpError(400, "PGRST100", `invalid identifier: ${s}`);
  return `"${s}"`;
};
function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.pgrst = { code, message, details: null, hint: null };
  return e;
}
const TABLES = new Set(["profiles", "farmers", "plots", "soil_reports", "recommendations", "digital_twins", "ndvi_readings", "weather_observations", "field_observations"]);
// resource embedding supported by this emulator (what the app uses)
const EMBEDS = {
  plots: {
    digital_twins: { kind: "children", table: "digital_twins", fk: "plot_id", pk: "id" },
    farmers: { kind: "parent", table: "farmers", fk: "farmer_id", pk: "id" },
  },
};

function splitTop(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function buildSelect(table, selectParam, alias) {
  const parts = splitTop(selectParam || "*");
  const cols = [];
  for (const p of parts) {
    const m = p.match(/^([a-z_][a-z0-9_]*)\((.*)\)$/s);
    if (m) {
      const rel = EMBEDS[table]?.[m[1]];
      if (!rel) throw httpError(400, "PGRST200", `no relationship between ${table} and ${m[1]}`);
      const inner = buildSelect(rel.table, m[2], "x");
      if (rel.kind === "children") {
        cols.push(`(select coalesce(json_agg(row_to_json(e)), '[]'::json) from (select ${inner} from public.${rel.table} x where x.${rel.fk} = ${alias}.${rel.pk}) e) as ${ident(m[1])}`);
      } else {
        cols.push(`(select row_to_json(e) from (select ${inner} from public.${rel.table} x where x.${rel.pk} = ${alias}.${rel.fk}) e) as ${ident(m[1])}`);
      }
    } else if (p === "*") cols.push(`${alias}.*`);
    else cols.push(`${alias}.${ident(p.split(":").pop())}`);
  }
  return cols.join(", ");
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
function buildWhere(query, params, table, colTypes) {
  const clauses = [];
  const add = (v, col) => {
    params.push(v);
    const typ = colTypes?.get(`${table}.${col}`);
    return typ ? `$${params.length}::text::${typ}` : `$${params.length}`;
  };
  const cond = (col, expr, alias = "t") => {
    const neg = expr.startsWith("not.");
    const e = neg ? expr.slice(4) : expr;
    const dot = e.indexOf(".");
    const op = e.slice(0, dot), val = e.slice(dot + 1);
    let sql;
    const c = `${alias}.${ident(col)}`;
    switch (op) {
      case "eq": sql = `${c} = ${add(val, col)}`; break;
      case "neq": sql = `${c} <> ${add(val, col)}`; break;
      case "gt": sql = `${c} > ${add(val, col)}`; break;
      case "gte": sql = `${c} >= ${add(val, col)}`; break;
      case "lt": sql = `${c} < ${add(val, col)}`; break;
      case "lte": sql = `${c} <= ${add(val, col)}`; break;
      case "in": {
        const items = splitTop(val.replace(/^\(|\)$/g, "")).map((x) => x.replace(/^"|"$/g, ""));
        sql = `${c}::text = any(${add(items)}::text[])`;
        break;
      }
      case "is": sql = val === "null" ? `${c} is null` : val === "true" ? `${c} is true` : `${c} is false`; break;
      default: throw httpError(400, "PGRST100", `unsupported operator ${op}`);
    }
    return neg ? `not (${sql})` : sql;
  };
  for (const [k, v] of Object.entries(query)) {
    if (RESERVED.has(k)) continue;
    if (k === "or") {
      const inner = splitTop(String(v).replace(/^\(|\)$/g, "")).map((item) => {
        const d = item.indexOf(".");
        return cond(item.slice(0, d), item.slice(d + 1));
      });
      clauses.push(`(${inner.join(" or ")})`);
    } else {
      clauses.push(cond(k, String(v)));
    }
  }
  return clauses.length ? ` where ${clauses.join(" and ")}` : "";
}
function buildOrder(order) {
  if (!order) return "";
  const parts = order.split(",").map((o) => {
    const [col, dir, nulls] = o.split(".");
    return `t.${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : ""}`;
  });
  return ` order by ${parts.join(", ")}`;
}

// ------------------------------------------------------------------- server
export async function startStack({ port = 54321, jwtSecret, quiet = false } = {}) {
  // PostgREST serialises numeric/bigint columns as JSON numbers and `date` as YYYY-MM-DD;
  // PGlite would hand back strings / Date objects, so match PostgREST's wire format.
  const db = new PGlite({
    parsers: {
      1700: (v) => Number(v), // numeric
      20: (v) => Number(v), // int8
      1082: (v) => v, // date
    },
  });
  await db.exec(readFileSync(path.join(here, "..", "supabase_shim.sql"), "utf8"));
  for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, f), "utf8"));
  }

  // column -> Postgres type, so filter values can be cast like PostgREST does
  const colTypes = new Map();
  for (const r of (await db.query(`select c.relname t, a.attname col, format_type(a.atttypid, a.atttypmod) typ
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped`)).rows) colTypes.set(`${r.t}.${r.col}`, r.typ);

  const credentials = new Map(); // email -> { id, password }
  const refreshTokens = new Map(); // token -> user id
  const log = (...a) => { if (!quiet) console.log("[stack]", ...a); };

  // PGlite is single-connection: serialise every unit of work.
  let chain = Promise.resolve();
  const exclusive = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  const now = () => Math.floor(Date.now() / 1000);
  const userJson = (row) => ({
    id: row.id, aud: "authenticated", role: "authenticated", email: row.email,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: row.raw_user_meta_data ?? {}, created_at: row.created_at,
  });
  const sessionFor = (row) => {
    const access = signJwt({
      sub: row.id, email: row.email, role: "authenticated", aud: "authenticated",
      iat: now(), exp: now() + 3600, user_metadata: row.raw_user_meta_data ?? {}, app_metadata: { provider: "email" },
    }, jwtSecret);
    const refresh = crypto.randomBytes(16).toString("hex");
    refreshTokens.set(refresh, row.id);
    return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now() + 3600, refresh_token: refresh, user: userJson(row) };
  };

  async function withRole(claims, fn) {
    return exclusive(async () => {
      await db.exec("begin");
      try {
        await db.exec(`set local role ${claims.role}`);
        await db.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub ?? ""]);
        const out = await fn();
        await db.exec("commit");
        return out;
      } catch (e) {
        await db.exec("rollback");
        throw e;
      }
    });
  }

  async function rest(req, res, url, bodyText) {
    const table = url.pathname.replace(/^\/rest\/v1\//, "").split("/")[0];
    if (!TABLES.has(table)) throw httpError(404, "PGRST205", `Could not find the table 'public.${table}'`);
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.headers.apikey;
    let claims;
    try { claims = verifyJwt(bearer, jwtSecret); } catch (e) { throw httpError(401, "PGRST301", String(e.message)); }
    if (!["anon", "authenticated", "service_role"].includes(claims.role)) throw httpError(401, "PGRST301", "invalid role");

    const query = Object.fromEntries(url.searchParams.entries());
    const prefer = String(req.headers.prefer || "");
    const wantsObject = /vnd\.pgrst\.object/.test(String(req.headers.accept || ""));
    const returnRep = /return=representation/.test(prefer);
    const body = bodyText ? JSON.parse(bodyText) : null;

    const selectRows = async (ids) => {
      const params = [];
      let where = buildWhere(ids ? { id: `in.(${ids.join(",")})` } : query, params, table, colTypes);
      const sql = `select ${buildSelect(table, query.select, "t")} from public.${table} t${where}${buildOrder(query.order)}${query.limit ? ` limit ${parseInt(query.limit, 10)}` : ""}${query.offset ? ` offset ${parseInt(query.offset, 10)}` : ""}`;
      return (await db.query(sql, params)).rows;
    };

    const result = await withRole(claims, async () => {
      if (req.method === "GET" || req.method === "HEAD") {
        const rows = await selectRows();
        return { status: 200, rows };
      }
      if (req.method === "POST") {
        const records = Array.isArray(body) ? body : [body];
        const ids = [];
        for (const rec of records) {
          const keys = Object.keys(rec);
          const params = keys.map((k) => (rec[k] !== null && typeof rec[k] === "object" ? JSON.stringify(rec[k]) : rec[k]));
          let sql = `insert into public.${table} (${keys.map(ident).join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`;
          if (/resolution=merge-duplicates/.test(prefer) && query.on_conflict) {
            const conflict = query.on_conflict.split(",").map(ident).join(",");
            const upd = keys.filter((k) => !query.on_conflict.split(",").includes(k));
            sql += ` on conflict (${conflict}) do update set ${upd.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(",")}`;
          }
          sql += " returning id";
          ids.push(...(await db.query(sql, params)).rows.map((r) => r.id));
        }
        return { status: 201, rows: returnRep || query.select ? await selectRows(ids) : [] };
      }
      if (req.method === "PATCH") {
        const keys = Object.keys(body);
        const params = keys.map((k) => (body[k] !== null && typeof body[k] === "object" ? JSON.stringify(body[k]) : body[k]));
        const sets = keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(", ");
        const where = buildWhere(query, params, table, colTypes);
        const upd = (await db.query(`update public.${table} t set ${sets}${where} returning t.id`, params)).rows.map((r) => r.id);
        return { status: returnRep ? 200 : 204, rows: returnRep ? await selectRows(upd) : [] };
      }
      if (req.method === "DELETE") {
        const params = [];
        const where = buildWhere(query, params, table, colTypes);
        const del = (await db.query(`delete from public.${table} t${where} returning id`, params)).rows.map((r) => r.id);
        return { status: returnRep ? 200 : 204, rows: returnRep ? del.map((id) => ({ id })) : [] };
      }
      throw httpError(405, "PGRST117", "method not allowed");
    });

    const send = (status, payload, extra = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...extra });
      res.end(payload === undefined ? "" : JSON.stringify(payload));
    };
    if (req.method === "HEAD") {
      return send(200, undefined, { "content-range": `0-${Math.max(result.rows.length - 1, 0)}/${result.rows.length}` });
    }
    if (result.status === 204) return send(204, undefined);
    if (wantsObject) {
      if (result.rows.length !== 1) throw httpError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned");
      return send(result.status, result.rows[0]);
    }
    return send(result.status, result.rows, { "content-range": `0-${Math.max(result.rows.length - 1, 0)}/*` });
  }

  async function auth(req, res, url, bodyText) {
    const body = bodyText ? JSON.parse(bodyText) : {};
    const send = (status, payload) => { res.writeHead(status, { "content-type": "application/json" }); res.end(payload === undefined ? "" : JSON.stringify(payload)); };
    const p = url.pathname.replace(/^\/auth\/v1/, "");
    if (p === "/signup" && req.method === "POST") {
      const email = String(body.email || "").toLowerCase();
      if (!email || !body.password || String(body.password).length < 6) return send(422, { code: 422, error_code: "weak_password", msg: "Password should be at least 6 characters." });
      if (credentials.has(email)) return send(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      const row = await exclusive(async () => (await db.query("insert into auth.users (email, raw_user_meta_data) values ($1,$2::jsonb) returning *", [email, JSON.stringify(body.data ?? {})])).rows[0]);
      credentials.set(email, { id: row.id, password: body.password });
      return send(200, sessionFor(row));
    }
    if (p === "/token" && req.method === "POST") {
      const grant = url.searchParams.get("grant_type");
      let row;
      if (grant === "password") {
        const c = credentials.get(String(body.email || "").toLowerCase());
        if (!c || c.password !== body.password) return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        row = await exclusive(async () => (await db.query("select * from auth.users where id=$1", [c.id])).rows[0]);
      } else if (grant === "refresh_token") {
        const uid = refreshTokens.get(body.refresh_token);
        if (!uid) return send(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        refreshTokens.delete(body.refresh_token);
        row = await exclusive(async () => (await db.query("select * from auth.users where id=$1", [uid])).rows[0]);
      } else return send(400, { msg: "unsupported grant_type" });
      return send(200, sessionFor(row));
    }
    if (p === "/user" && req.method === "GET") {
      try {
        const claims = verifyJwt((req.headers.authorization || "").replace(/^Bearer\s+/i, ""), jwtSecret);
        const row = await exclusive(async () => (await db.query("select * from auth.users where id=$1", [claims.sub])).rows[0]);
        return row ? send(200, userJson(row)) : send(401, { msg: "user not found" });
      } catch { return send(401, { code: 401, msg: "invalid JWT" }); }
    }
    if (p === "/logout") return send(204);
    if (p === "/health") return send(200, { name: "GoTrue (emulated)" });
    return send(501, { msg: `not implemented in the local emulation: ${req.method} ${p}` });
  }

  const server = http.createServer(async (req, res) => {
    const cors = {
      "access-control-allow-origin": req.headers.origin || "*",
      "access-control-allow-headers": "authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, x-client-info, range, x-supabase-api-version",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,HEAD,OPTIONS",
      "access-control-expose-headers": "content-range",
      vary: "Origin",
    };
    const origWrite = res.writeHead.bind(res);
    res.writeHead = (status, headers = {}) => origWrite(status, { ...cors, ...headers });
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, `http://${req.headers.host}`);
    let bodyText = "";
    for await (const chunk of req) bodyText += chunk;
    try {
      if (url.pathname.startsWith("/rest/v1/")) await rest(req, res, url, bodyText);
      else if (url.pathname.startsWith("/auth/v1/")) await auth(req, res, url, bodyText);
      else { res.writeHead(404, { "content-type": "application/json" }); res.end("{}"); }
    } catch (e) {
      const pgrst = e.pgrst ?? {
        code: e.code || "XX000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null,
      };
      const status = e.status ?? (pgrst.code === "42501" ? 403 : /^23/.test(pgrst.code) ? 409 : pgrst.code === "22P02" ? 400 : pgrst.code === "42P01" ? 404 : 400);
      log(req.method, url.pathname + url.search, "->", status, pgrst.code, pgrst.message);
      if (!res.headersSent) { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(pgrst)); }
    }
  });
  // Real PostgREST/GoTrue sit behind proxies that keep idle connections for >= 60s. Node's 5s default
  // makes pooled clients (httpx in the backend) hit half-closed sockets, which real Supabase does not.
  server.keepAliveTimeout = 75_000;
  server.headersTimeout = 80_000;
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  log(`listening on http://127.0.0.1:${port}`);

  return {
    url: `http://127.0.0.1:${port}`,
    db,
    anonKey: signJwt({ role: "anon", iss: "e2e-emulation", iat: now(), exp: now() + 86400 }, jwtSecret),
    serviceRoleKey: signJwt({ role: "service_role", iss: "e2e-emulation", iat: now(), exp: now() + 86400 }, jwtSecret),
    exec: (sql, params) => exclusive(() => db.query(sql, params)),
    close: () => new Promise((r) => server.close(r)),
  };
}
