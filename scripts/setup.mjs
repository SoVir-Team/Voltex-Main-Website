import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Resolve from this script so setup works independently of the caller's directory.
const root = new URL("../", import.meta.url);
const environments = [
  { example: "frontend/.env.example", target: "frontend/.env.local" },
  { example: "backend/.env.example", target: "backend/.env", secret: true },
];

for (const { example, target, secret } of environments) {
  let contents = (await readFile(new URL(example, root), "utf8")).replace(/\r\n/g, "\n");
  if (secret) {
    contents = contents.replace(/^JWT_SECRET=CHANGE_ME$/m, `JWT_SECRET=${randomBytes(48).toString("base64url")}`);
  }

  try {
    // Exclusive creation protects existing credentials and local configuration.
    await writeFile(new URL(target, root), contents, { flag: "wx", mode: 0o600 });
    console.log(`Created ${target}`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Preserved existing ${target}`);
  }
}

console.log(`Environment files ready in ${fileURLToPath(root)}`);
console.log("Configure backend/.env database URLs and admin credentials before migrations or startup.");
