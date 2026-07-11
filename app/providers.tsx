"use client";

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { AuthProvider } from "@/components/auth/auth-provider";
import { MockProvider } from "@/components/mocks/mock-provider";
import { RecordingProvider } from "@/components/transcription/recording-provider";
import type { AuthUser } from "@/lib/auth/types";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const queryClient = getQueryClient();

  return (
    <MockProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={initialUser}>
          <RecordingProvider>{children}</RecordingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MockProvider>
  );
}
