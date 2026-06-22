import { PageTransition } from "@/components/layout/PageTransition";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
