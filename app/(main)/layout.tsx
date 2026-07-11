import { PageTransition } from "@/components/layout/PageTransition";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
