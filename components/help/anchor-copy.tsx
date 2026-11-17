"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { cn } from "@/lib/utils";

export function AnchorCopy({ id, title }: { id: string; title: string }) {
  const t = useTranslations("help.anchor");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={t("copy", { title })}
      onClick={async () => {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = id;
        window.history.replaceState(window.history.state, "", `#${id}`);
        try {
          await navigator.clipboard.writeText(url.toString());
          setCopied(true);
        } catch {}
      }}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[8px] text-[var(--tv-muted)] help-fade hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-brand-deep)] motion-reduce:transition-none",
        copied
          ? "text-[var(--tv-brand-deep)] opacity-100"
          : "opacity-0 group-focus-within/heading:opacity-100 group-hover/heading:opacity-100",
        FOCUS
      )}
    >
      {copied ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <Link2 aria-hidden className="size-4" />
      )}
      <span role="status" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </button>
  );
}
