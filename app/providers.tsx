import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { MockProvider } from "@/components/mocks/mock-provider";
import { getCurrentUserForSsr } from "@/lib/auth/server";

type AppProvidersProps = {
  children: ReactNode;
};

type ProvidersProps = AppProvidersProps & {
  initialUser: Awaited<ReturnType<typeof getCurrentUserForSsr>>;
};

export function Providers({ children, initialUser }: ProvidersProps) {
  return (
    <MockProvider>
      <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
    </MockProvider>
  );
}

export async function AppProviders({ children }: AppProvidersProps) {
  const initialUser = await getCurrentUserForSsr();

  return <Providers initialUser={initialUser}>{children}</Providers>;
}
