import { z } from "zod";
import type {
  AuthSessionResponseData,
  AuthSessionResponseDataUser,
} from "@/lib/api/generated/models";

const userSchema = z.object({
  userId: z.string().min(1),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
}) satisfies z.ZodType<AuthSessionResponseDataUser>;

const sessionSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("authenticated"), user: userSchema }).strict(),
  z.object({ state: z.literal("anonymous") }).strict(),
  z.object({ state: z.literal("refresh_required") }).strict(),
]) satisfies z.ZodType<AuthSessionResponseData>;

// Runtime validation is shared by SSR and browser probes; malformed success
// responses cannot be mistaken for a user or an anonymous session.
export function parseAuthSession(data: unknown) {
  return sessionSchema.parse(data);
}
