/**
 * One command to refresh the deployed database from a downloaded Inducks dump.
 *
 * The only step that needs a human is getting `isv.tgz` past Anubis in a
 * browser (https://inducks.org/inducks/isv.tgz). Everything after that is here:
 *
 *   pnpm db:release -- --archive "C:/Users/you/Downloads/isv.tgz"
 *
 *   1. build inducks.sqlite.gz from the archive (scripts/generate-db.ts), straight
 *      into public/datas/ — the one place the deploy bundles, the browser fetches and
 *      the other apps read, so there is nothing left to copy
 *   2. upload it to the `datas` GitHub release (the deploy pulls from there)
 *   3. trigger the Pages deploy so production picks it up
 *
 * GitHub Pages cannot serve a 300 MB file itself, so the release stays the
 * host and step 3 is what avoids a manual redeploy. Flags:
 *
 *   --local-only   stop after step 1 (no GitHub actions at all)
 *   --no-deploy    do steps 1-2 but leave the deploy to you
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const GZ = "inducks.sqlite.gz";
const DEPLOY_WORKFLOW = "Deploy to GitHub Pages";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};

const archive = valueOf("--archive");
const localOnly = flag("--local-only");
const noDeploy = flag("--no-deploy");

if (!archive) {
  console.error(
    "Usage: pnpm db:release -- --archive <path/to/isv.tgz> [--local-only] [--no-deploy]\n" +
      "Download the archive from https://inducks.org/inducks/isv.tgz in a browser first."
  );
  process.exit(1);
}
if (!fs.existsSync(archive)) {
  console.error(`Archive not found: ${archive}`);
  process.exit(1);
}

// Run through a shell so Windows resolves the npx/gh `.cmd` shims; quote args
// so a path with spaces ("isv tgz") survives.
const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
};

// 1. Build the database from the archive.
run(`npx tsx scripts/generate-db.ts --archive "${archive}"`);

// The build writes straight into public/datas/, so this is also the file to publish
// and the one a local `pnpm dev` already serves.
const gzPath = path.join(ROOT, "public", "datas", GZ);
if (!fs.existsSync(gzPath)) {
  console.error(`Build did not produce public/datas/${GZ}. Aborting.`);
  process.exit(1);
}
const sizeMb = Math.round((fs.statSync(gzPath).size / 1024 / 1024) * 10) / 10;
console.log(`\npublic/datas/${GZ}: ${sizeMb} MB, ready to be published.`);

if (localOnly) {
  console.log("\n--local-only: done. Nothing was pushed to GitHub.");
  process.exit(0);
}

// 2. Publish to the release the deploy pulls from. `gh` infers the repo from
//    this checkout's remote; run it where you are authenticated.
run(`gh release upload datas "${gzPath}" --clobber`);
console.log(`\nUploaded ${GZ} to the "datas" release.`);

if (noDeploy) {
  console.log(`\n--no-deploy: skipping the deploy. Trigger it yourself with:\n  gh workflow run "${DEPLOY_WORKFLOW}"`);
  process.exit(0);
}

// 3. Rebuild the site so it bundles the fresh database.
run(`gh workflow run "${DEPLOY_WORKFLOW}"`);
console.log(`\nDeploy triggered — production will carry the fresh database once it finishes.`);
console.log(`Watch it with:  gh run watch  (or the Actions tab)`);
