import Link from "next/link";
import { KeyRound, LayoutDashboard, ListChecks, RadioTower, Shield } from "lucide-react";

const navItems = [
  { href: "/", label: "검사", icon: Shield },
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/review", label: "검수 큐", icon: ListChecks },
  { href: "/admin/webhooks", label: "Webhook", icon: RadioTower },
  { href: "/settings/api-keys", label: "API Keys", icon: KeyRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cg-cream)] text-[var(--cg-ink)]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[var(--cg-green)] text-white shadow-sm">
              <Shield className="size-5" />
            </span>
            <span>
              <span className="block text-[17px] font-semibold leading-tight tracking-[-0.01em]">
                content-guard.ai
              </span>
              <span className="block text-xs font-medium text-black/55">
                image risk operations
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-black/70 transition hover:bg-[var(--cg-ceramic)] hover:text-[var(--cg-green)]"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/scans/scan_9K2P1"
            className="hidden h-10 items-center rounded-full border border-[var(--cg-green)] px-4 text-sm font-semibold text-[var(--cg-green)] transition hover:bg-[var(--cg-green)] hover:text-white sm:inline-flex"
          >
            샘플 결과
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
