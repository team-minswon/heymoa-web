import Link from "next/link";

const items = [
  { label: "Overview", href: "" },
  { label: "API Keys", href: "/api-keys" },
  { label: "Webhooks", href: "/webhooks" },
  { label: "Usage", href: "/usage" },
  { label: "Members", href: "/members" },
  { label: "Settings", href: "/settings" },
];

type DashboardSidebarProps = {
  organizationPublicId: string;
};

export function DashboardSidebar({
  organizationPublicId,
}: DashboardSidebarProps) {
  const base = `/dashboard/${organizationPublicId}`;

  return (
    <aside className="border-b border-border bg-muted md:w-60 md:border-b-0 md:border-r">
      <nav className="flex gap-2 overflow-x-auto p-4 md:flex-col">
        {items.map((item) => (
          <Link
            key={item.label}
            className="whitespace-nowrap border border-border bg-background px-3 py-2 text-sm font-medium md:w-full"
            href={`${base}${item.href}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
