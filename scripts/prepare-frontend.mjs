import { access, cp } from "node:fs/promises";

const frontend = new URL("../frontend/", import.meta.url);
const standalone = new URL(".next/standalone/frontend/", frontend);

// Next.js traces server dependencies but leaves these assets out of standalone.
// Package them at build time so the production start command serves a complete app.
await access(new URL("server.js", standalone));
await cp(new URL("public/", frontend), new URL("public/", standalone), { recursive: true });
await cp(new URL(".next/static/", frontend), new URL(".next/static/", standalone), { recursive: true });

console.log("Prepared standalone frontend server with public assets and static chunks.");
