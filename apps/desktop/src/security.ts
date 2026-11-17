import type { WebContents } from "electron";
import { isTrustedUrl } from "./policy";

export function onDocumentReplacement(
  contents: WebContents,
  origin: string,
  revoke: () => void
) {
  contents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace && isTrustedUrl(url, origin)) revoke();
  });
  contents.on("did-navigate", () => revoke());
}

export function secureContents(
  contents: WebContents,
  origin: string,
  openExternal: (url: string) => void
) {
  contents.session.setPermissionCheckHandler(() => false);
  contents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(url, origin)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  contents.on("will-redirect", (event, url) => {
    if (!isTrustedUrl(url, origin)) event.preventDefault();
  });
  contents.on("will-frame-navigate", (event) => {
    // Main-frame navigation proceeds to will-navigate, which opens safe external links.
    // Cancelling here would suppress that later event entirely.
    if (!event.isMainFrame && !isTrustedUrl(event.url, origin))
      event.preventDefault();
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
}
