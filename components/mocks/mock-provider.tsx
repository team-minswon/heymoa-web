"use client";

import { useEffect, useState } from "react";

import { enableMocking, shouldEnableMocking } from "@/lib/mocks/enable-mocking";

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!shouldEnableMocking());

  useEffect(() => {
    let mounted = true;

    enableMocking()
      .catch((error) => {
        console.error("Failed to start API mocks.", error);
      })
      .finally(() => {
        if (mounted) {
          setReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
