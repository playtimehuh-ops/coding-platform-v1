import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.isFile() && path.endsWith(".js")) out.push(path);
  }
  return out;
}

const files = walk(".")
  .filter(file => !file.includes("node_modules"))
  .filter(file => !file.includes(".git"));

let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write("\nSyntax error in " + file + "\n");
    process.stderr.write(result.stderr || result.stdout || "");
  }
}

if (failed) process.exit(1);

console.log("Checked " + files.length + " JavaScript files.");
