import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isLanguage, setLanguage, type Language } from "./i18n";

let persisted: Language | null = null;

export async function loadLanguage(directory: string, osLocale: string) {
  let language: Language = /^ko(?:[-_]|$)/i.test(osLocale) ? "ko" : "en";
  setLanguage(language);
  let stored = false;
  try {
    const saved = JSON.parse(
      await readFile(path.join(directory, "preferences.json"), "utf8")
    );
    if (isLanguage(saved?.language)) {
      language = saved.language;
      stored = true;
    }
  } catch (error) {
    if (
      !(error instanceof SyntaxError) &&
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    )
      console.warn(
        "Language preferences could not be read; using the system language"
      );
  }
  setLanguage(language);
  persisted = stored ? language : null;
  return stored;
}
let saving = Promise.resolve();
export function saveLanguage(
  directory: string,
  language: Language
): Promise<void> {
  const next = saving
    .catch(() => {})
    .then(async () => {
      if (persisted === language) {
        setLanguage(language);
        return;
      }
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, "preferences.json");
      await writeFile(file + ".tmp", JSON.stringify({ language }), {
        mode: 0o600,
      });
      await rename(file + ".tmp", file);
      persisted = language;
      setLanguage(language);
    });
  saving = next;
  return next;
}

export async function loadAutomaticUpdates(
  directory: string
): Promise<boolean> {
  try {
    const saved = JSON.parse(
      await readFile(path.join(directory, "updates.json"), "utf8")
    );
    return saved?.automatic === undefined ? true : saved.automatic === true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}
export async function saveAutomaticUpdates(
  directory: string,
  automatic: boolean
): Promise<void> {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, "updates.json");
  await writeFile(file + ".tmp", JSON.stringify({ automatic }), {
    mode: 0o600,
  });
  await rename(file + ".tmp", file);
}

export type PanelPreferences = {
  pinned: boolean;
  opacity: number;
  position?: { x: number; y: number };
};
export const defaultPanelPreferences: PanelPreferences = {
  pinned: false,
  opacity: 1,
};
export async function loadPanelPreferences(
  directory: string
): Promise<PanelPreferences> {
  try {
    const saved = JSON.parse(
      await readFile(path.join(directory, "meeting-panel.json"), "utf8")
    );
    return {
      pinned: saved?.pinned === true,
      opacity:
        typeof saved?.opacity === "number" &&
        Number.isFinite(saved.opacity) &&
        saved.opacity >= 0.6 &&
        saved.opacity <= 1
          ? saved.opacity
          : 1,
      ...(Number.isFinite(saved?.position?.x) &&
      Number.isFinite(saved?.position?.y) &&
      Math.abs(saved.position.x) <= 1_000_000 &&
      Math.abs(saved.position.y) <= 1_000_000
        ? {
            position: {
              x: Math.round(saved.position.x),
              y: Math.round(saved.position.y),
            },
          }
        : {}),
    };
  } catch {
    return { ...defaultPanelPreferences };
  }
}
let savingPanel = Promise.resolve();
export function savePanelPreferences(
  directory: string,
  value: PanelPreferences
): Promise<void> {
  const snapshot = JSON.stringify(value);
  const next = savingPanel
    .catch(() => {})
    .then(async () => {
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, "meeting-panel.json");
      await writeFile(file + ".tmp", snapshot, { mode: 0o600 });
      await rename(file + ".tmp", file);
    });
  savingPanel = next;
  return next;
}
