import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

// Bundles the function, with everything it imports from the workspace
// (@cero/core, @cero/firestore, the Express app), into lib/. That folder is
// what firebase.json deploys, so a deploy needs no workspace links: only the
// runtime dependencies stay external, and Cloud Build installs them from the
// package.json written next to the bundle.

const packageDir = import.meta.dirname;
const manifest = JSON.parse(await readFile(`${packageDir}/package.json`, "utf8"));
const runtimeDependencies: Record<string, string> = manifest.dependencies;

await build({
  absWorkingDir: packageDir,
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  // CommonJS, because Express and its middleware are CommonJS and require()
  // Node's built-ins, which an ES module bundle cannot do.
  format: "cjs",
  external: Object.keys(runtimeDependencies),
  sourcemap: true,
  logLevel: "info",
});

const deployManifest = { name: manifest.name, private: true, main: "index.js", dependencies: runtimeDependencies };
await writeFile(`${packageDir}/lib/package.json`, `${JSON.stringify(deployManifest, null, 2)}\n`);
