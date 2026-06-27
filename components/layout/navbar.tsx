import Link from "next/link";
import { AuthStatus } from "@/components/auth/auth-status";
import { siteConfig } from "@/lib/site";

export function Navbar() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link className="text-sm font-semibold" href="/">
          {siteConfig.name}
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              className="hover:text-foreground"
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <AuthStatus />
      </div>
    </header>
  );
}
