"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LegacyHashRedirect({
  map,
}: {
  map: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const target = Object.hasOwn(map, id) ? map[id] : undefined;
    if (target) router.replace(target);
  }, [map, router]);
  return null;
}
