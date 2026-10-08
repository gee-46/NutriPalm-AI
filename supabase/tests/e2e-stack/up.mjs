// Starts only the emulated Supabase stack and writes its (random, per-run) keys to a temp file
// outside the repo. Used when you want to start backend/frontend by hand.
import { startStack } from "./stack.mjs";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
const secret = crypto.randomBytes(32).toString("hex");
const s = await startStack({ port: Number(process.env.STACK_PORT || 54321), jwtSecret: secret });
const out = path.join(tmpdir(), "nutripalm-e2e-env.json");
writeFileSync(out, JSON.stringify({ url: s.url, anon: s.anonKey, service: s.serviceRoleKey, secret }));
console.log("stack ready; env written to", out);
