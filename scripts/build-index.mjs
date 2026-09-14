import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Script } from "node:vm";
import Ajv from "ajv";

const root = fileURLToPath(new URL("../", import.meta.url));
const validate = new Ajv({ allErrors: true }).compile(
  JSON.parse(await readFile(join(root, "hackstore-manifest.schema.json"), "utf8")),
);
const directories = (await readdir(join(root, "extensions"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
const entries = [];
const ids = new Set();
for (const directory of directories) {
  const path = join(root, "extensions", directory.name);
  const manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8"));
  if (!validate(manifest)) throw new Error(`${directory.name}: ${JSON.stringify(validate.errors)}`);
  if (ids.has(manifest.id)) throw new Error(`Duplicate extension id: ${manifest.id}`);
  ids.add(manifest.id);
  const names = new Set();
  for (const tool of manifest.tools) {
    if (names.has(tool.name)) throw new Error(`${manifest.id}: duplicate tool ${tool.name}`);
    names.add(tool.name);
    if (tool.required?.some((name) => !Object.hasOwn(tool.parameters, name))) {
      throw new Error(`${manifest.id}: required parameter missing from ${tool.name}`);
    }
  }
  const source = await readFile(join(path, "plugin.js"), "utf8");
  // Parse only. Building the registry must never execute extension code.
  new Script(source, { filename: join(path, "plugin.js") });
  entries.push({
    id: manifest.id,
    version: manifest.version,
    manifest,
    source: { kind: "inline", files: { "plugin.js": source } },
  });
}
const output = `${JSON.stringify({ entries }, null, 2)}\n`;
const target = join(root, "index.json");
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8") !== output) {
    throw new Error("index.json is out of date. Run npm run build and include index.json in your commit.");
  }
  console.log(`Checked ${entries.length} extension(s); index.json matches source.`);
} else {
  await writeFile(target, output);
  console.log(`Built index.json from ${entries.length} extension(s).`);
}
