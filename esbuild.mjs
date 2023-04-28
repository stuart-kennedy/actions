import { build } from "esbuild";
import glob from "globby";

const config = {
  bundle: true,
  minify: true,
  charset: "utf8",
  entryPoints: await glob("src/*/main.ts"),
  outdir: "lib",
  outExtension: { ".js": ".cjs" },
  platform: "node",
  target: "node16",
  mainFields: ["module", "main"],
};

build(config)
  .then(() => console.info("Build completed successfully."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
