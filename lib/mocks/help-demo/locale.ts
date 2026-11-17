export type HelpDemoLocale = "ko" | "en";

export function helpDemoLocale(): HelpDemoLocale {
  if (typeof document === "undefined") return "ko";
  return document.documentElement.lang === "en" ? "en" : "ko";
}
