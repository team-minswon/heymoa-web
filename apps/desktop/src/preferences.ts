import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isLanguage, setLanguage, type Language } from "./i18n";

let persisted: Language | null = null;

export async function loadLanguage(directory: string, osLocale: string) {
  let language: Language = /^ko(?:[-_]|$)/i.test(osLocale) ? "ko" : "en";
  setLanguage(language);
  let stored = false;
  try {
    const saved = JSON.parse(await readFile(path.join(directory, "preferences.json"), "utf8"));
    if (isLanguage(saved?.language)) { language = saved.language; stored = true; }
  } catch (error) {
    if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") console.warn("Language preferences could not be read; using the system language");
  }
  setLanguage(language);
  persisted = stored ? language : null;
  return stored;
}
let saving = Promise.resolve();
export function saveLanguage(directory: string, language: Language): Promise<void> {
  const next = saving.catch(() => {}).then(async () => {
    if (persisted === language) { setLanguage(language); return; }
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, "preferences.json");
    await writeFile(file + ".tmp", JSON.stringify({ language }), { mode: 0o600 });
    await rename(file + ".tmp", file);
    persisted = language;
    setLanguage(language);
  });
  saving = next;
  return next;
}
