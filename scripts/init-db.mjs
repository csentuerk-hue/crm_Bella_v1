import { execSync } from "node:child_process";

try {
  execSync("node scripts/run-prisma-with-env.mjs migrate deploy", { stdio: "inherit" });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
