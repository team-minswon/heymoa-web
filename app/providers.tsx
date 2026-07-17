"use client";

import { environmentManager, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/components/auth/auth-provider";
import { MockProvider } from "@/components/mocks/mock-provider";
import {
  RecordingProvider,
  useRecording,
} from "@/components/transcription/recording-provider";
import { RecordingErrorToast } from "@/components/transcription/recording-error-toast";
import type { AuthUser } from "@/lib/auth/types";
import { makeQueryClient } from "@/lib/query/query-client";

type AppQueryClient = ReturnType<typeof makeQueryClient>;

let browserQueryClient: AppQueryClient | undefined;

function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

function AuthenticatedProviders({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const { disconnect } = useRecording();

  return (
    <AuthProvider initialUser={initialUser} beforeLogout={disconnect}>
      {children}
    </AuthProvider>
  );
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
        <RecordingProvider>
          <RecordingErrorToast />
          <AuthenticatedProviders initialUser={initialUser}>
            {children}
          </AuthenticatedProviders>
        </RecordingProvider>
      </QueryClientProvider>
    </MockProvider>
  );
}
