import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

export async function loadTransformedModule(filePath, transforms = []) {
  let source = await fs.readFile(path.join(repoRoot, filePath), "utf8");

  for (const [pattern, replacement] of transforms) {
    source = source.replace(pattern, replacement);
  }

  const payload = Buffer.from(
    `${source}\n//# sourceURL=${filePath}\n`,
    "utf8",
  ).toString("base64");

  return import(`data:text/javascript;base64,${payload}`);
}
