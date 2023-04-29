import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { build } from "esbuild";
import { globby } from "globby";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUT_DIR = "lib";

const config = {
  bundle: true,
  minify: true,
  sourcemap: true,
  charset: "utf8",
  entryPoints: await globby("src/*/main.ts"),
  outdir: OUT_DIR,
  outExtension: { ".js": ".mjs" },
  format: "esm",
  platform: "node",
  target: "node16",
  mainFields: ["module", "main"],
  banner: {
    js: 'import { createRequire } from "module";const require = createRequire(import.meta.url);',
  },
};

// Clean previous build output.
await rm(join(__dirname, OUT_DIR), { recursive: true, force: true });

build(config)
  .then(({ warnings }) => {
    warnings.forEach(console.warn);
    console.info("Build completed successfully.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
