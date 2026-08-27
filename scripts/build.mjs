import { cp, mkdir, readdir, writeFile, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");

async function collectJs(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collectJs(full, acc);
    else if (/\.(js|mjs)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const folders = ["js", "lib", "api", "scripts", "tests"];
const files = [];
for (const folder of folders) {
  await collectJs(join(root, folder), files);
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed += 1;
    console.error(result.stderr || result.stdout);
  }
}

if (failed) {
  console.error(`Build falhou: ${failed} arquivo(s) com erro de sintaxe.`);
  process.exit(1);
}

await mkdir(dist, { recursive: true });
for (const item of ["index.html", "pharus_logo.png", "css", "js", "lib", "api"]) {
  await cp(join(root, item), join(dist, item), { recursive: true });
}
await copyFile(join(root, "pharus_logo.png"), join(dist, "pharus-favicon.png"));

await mkdir(dirname(join(dist, "package.json")), { recursive: true });
await writeFile(join(dist, ".build-ok"), new Date().toISOString());
console.log(`Build ok. ${files.length} módulos verificados. Artefatos em dist/.`);
