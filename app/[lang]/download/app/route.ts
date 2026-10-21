import {
  DESKTOP_INSTALLERS,
  DESKTOP_RELEASES_URL,
} from "@/lib/desktop/downloads";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const href = `/download/app?os=${searchParams.get("os")}&arch=${searchParams.get("arch")}`;
  const installer = [
    ...DESKTOP_INSTALLERS.mac,
    ...DESKTOP_INSTALLERS.windows,
  ].find((item) => item.href === href);
  return new Response(null, {
    status: 307,
    headers: {
      Location: installer
        ? `${DESKTOP_RELEASES_URL}/latest/download/${installer.file}`
        : new URL("/download", request.url).href,
      "Cache-Control": "no-store",
    },
  });
}
