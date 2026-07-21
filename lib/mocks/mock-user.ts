import type { AuthUser } from "@/lib/auth/types";

// Single source of truth for the mock identity. The SSR mock user
// (lib/auth/server.ts) and the client MSW store (lib/mocks/db.ts) MUST match,
// otherwise hydration sees two different users and auth breaks.
export const MOCK_USER: AuthUser = {
  userId: "user-12345",
  name: "테스트 유저",
  email: "test@heymoa.com",
  image: null,
};
