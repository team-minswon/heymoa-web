export const helpAssetUrl = (path: string) =>
  `${(process.env.NEXT_PUBLIC_HELP_IMAGE_BASE ?? "").replace(/\/+$/, "")}/help/${path.replace(/^\/+/, "")}`;
