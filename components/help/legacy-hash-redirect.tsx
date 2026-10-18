"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 한 장짜리 시절의 `/help#recording` 같은 링크를 새 주제 주소로 옮긴다. 해시는 서버가 못 읽어서 클라이언트에서 한다.
 * 허브 안의 새 해시(없는 키)는 그대로 둔다.
 */
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
      return; // 깨진 해시(`#%`)는 알 수 없는 해시로 본다
    }
    const target = Object.hasOwn(map, id) ? map[id] : undefined;
    if (target) router.replace(target);
  }, [map, router]);
  return null;
}
