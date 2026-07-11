export function isWorkspaceRoute(pathname: string) {
  return pathname === "/w" || pathname.startsWith("/w/");
}
