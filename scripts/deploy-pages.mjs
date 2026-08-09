import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const distDir = join(repoRoot, "dist");
const remote = "https://github.com/Sphynx-HenryAY/coa-dmg-calc.git";
const work = mkdtempSync(join(tmpdir(), "coa-pages-"));

function run(cmd, cwd = work) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

try {
  cpSync(distDir, work, { recursive: true });
  run("git init");
  run("git checkout -b gh-pages");
  run("git add -A");
  run('git -c user.email="pages@local" -c user.name="Pages Deploy" commit -m "Deploy GitHub Pages"');
  run(`git remote add origin ${remote}`);
  run("git push -f origin gh-pages");
  console.log("\nDeployed: https://sphynx-henryay.github.io/coa-dmg-calc/");
} finally {
  rmSync(work, { recursive: true, force: true });
}
