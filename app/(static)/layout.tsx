import { StaticShell } from "@/components/realillust/static-shell";

export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaticShell>{children}</StaticShell>;
}
