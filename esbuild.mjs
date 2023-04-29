import { build } from "esbuild";
import { globby } from "globby";

const config = {
  bundle: true,
  minify: true,
  charset: "utf8",
  entryPoints: await globby("src/*/main.ts"),
  outdir: "lib",
  outExtension: { ".js": ".mjs" },
  format: "esm",
  platform: "node",
  target: "node16",
  mainFields: ["module", "main"],
  banner: {
    js: 'import { createRequire } from "module";const require = createRequire(import.meta.url);',
  },
};

build(config)
  .then(({ warnings }) => {
    warnings.forEach(console.warn);
    console.info("Build completed successfully.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
