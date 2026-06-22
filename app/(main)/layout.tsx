import { AppShell } from "@/components/realillust/app-shell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
