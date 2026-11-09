import { getLanguage, setLanguage, t, type Language } from "../src/i18n";
export function localize(language: Language) {
  setLanguage(language);
  document.documentElement.lang = getLanguage();
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => {
    node.dataset.i18n ||= node.textContent?.trim();
    node.textContent = t(node.dataset.i18n!);
  });
  for (const attribute of ["aria-label", "title"]) {
    document.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach((node) => {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)!));
    });
  }
}
