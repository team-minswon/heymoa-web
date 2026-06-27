import { GoogleLoginButton } from "@/components/auth/google-login-button";

export function DashboardAuthRequired() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-sm text-muted-foreground">Dashboard</p>
      <h1 className="mt-4 text-3xl font-semibold">Login required</h1>
      <p className="mt-4 text-muted-foreground">
        Use Google OAuth to access organization dashboards.
      </p>
      <div className="mt-8">
        <GoogleLoginButton />
      </div>
    </main>
  );
}
