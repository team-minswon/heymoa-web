import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { getCurrentUserForSsr } from "@/lib/auth/server";

type AppProvidersProps = {
  children: ReactNode;
};

export async function AppProviders({ children }: AppProvidersProps) {
  const initialUser = await getCurrentUserForSsr();

  return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>;
}
