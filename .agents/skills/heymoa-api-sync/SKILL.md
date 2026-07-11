---
name: heymoa-api-sync
description: |
  Use when openapi3.yml has changed or a new API endpoint needs to be integrated.
  Handles Orval code generation, mock handler updates, and type synchronization.
  Trigger on: openapi3.yml changes, new API endpoint requests, "pnpm orval" mentions, mock handler issues.
---

# HeyMoa API Sync Skill

## When to Use
- `openapi3.yml` has been modified (by user or server team)
- A new API endpoint needs to be consumed in the frontend
- MSW mock handlers need updating after API spec changes
- Type mismatches between generated types and hand-written `lib/auth/types.ts`

## Workflow

### Step 1: Validate the OpenAPI spec
```bash
# Ensure the spec is well-formed before generation
cat openapi3.yml | head -20
```

### Step 2: Run Orval code generation
```bash
pnpm orval
```
This generates into `lib/api/generated/`:
- `models/` — TypeScript interfaces from OpenAPI schemas
- `{tag}/` directories — Each tag gets its own folder with:
  - `{tag}.ts` — TanStack Query hooks (uses `apiFetch` mutator from `lib/api/fetcher.ts`)
  - `{tag}.msw.ts` — MSW request handlers
  - `{tag}.faker.ts` — Faker.js mock data factories

### Step 3: Update MSW handlers
After generation, update `lib/mocks/handlers.ts`:

**CRITICAL RULES:**
- Import generated mock handlers from `lib/api/generated/{tag}/{tag}.msw.ts`
- **NEVER use default faker-generated responses** — they produce random `success: true/false` which breaks auth flow
- **ALWAYS pass explicit override responses** with `success: true` and deterministic mock data
- Keep the mock user consistent: `userId: "user-12345"`, `name: "테스트 유저"`, `email: "test@heymoa.com"`

Example pattern:
```typescript
import { getGetV1UsersMeMockHandler } from "@/lib/api/generated/user/user.msw";

export const handlers = [
  getGetV1UsersMeMockHandler({
    success: true,
    data: {
      userId: "user-12345",
      name: "테스트 유저",
      email: "test@heymoa.com",
    },
  }),
];
```

### Step 4: Sync hand-written types (if needed)
If the API response shape changed, update `lib/auth/types.ts` to match the generated types in `lib/api/generated/models/`.

Also update `lib/auth/server.ts` mock return value to match.

### Step 5: Verify
```bash
pnpm lint && pnpm build
```

## Key Files
- `openapi3.yml` — API contract (source of truth)
- `orval.config.ts` — Orval configuration (mutator, output paths, client type)
- `lib/api/fetcher.ts` — Custom fetch wrapper with auth token refresh interceptor
- `lib/api/generated/` — All generated code (DO NOT edit manually)
- `lib/mocks/handlers.ts` — MSW handler registry (manually maintained, imports from generated)
- `lib/auth/types.ts` — Hand-written auth types that must stay in sync with generated models

## Common Pitfalls
1. **Faker randomness breaking auth**: Generated MSW handlers use `faker.datatype.boolean()` for `success` — override to `true` always.
2. **SSR mock gap**: `lib/auth/server.ts` runs server-side where MSW doesn't intercept. The `shouldEnableMocking()` branch must return hard-coded mock user data.
3. **Stale `.next` cache**: After Orval regeneration, if dev server shows old types, run `rm -rf .next && pnpm dev`.
