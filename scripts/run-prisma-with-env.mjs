import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvFile(filePath, override) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const valueRaw = line.slice(separator + 1).trim();
    const value = valueRaw.replace(/^"(.*)"$/, "$1");

    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function main() {
  loadEnvFile(path.join(process.cwd(), ".env"), false);
  loadEnvFile(path.join(process.cwd(), ".env.local"), true);

  const prismaArgs = process.argv.slice(2);
  if (prismaArgs.length === 0) {
    console.error("Missing Prisma command. Example: node scripts/run-prisma-with-env.mjs migrate deploy");
    process.exit(1);
  }

  const result = spawnSync("npx", ["prisma", ...prismaArgs], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

main();
