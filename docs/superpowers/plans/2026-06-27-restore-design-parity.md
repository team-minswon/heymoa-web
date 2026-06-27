# Restore Design Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the visual design from pre-rebuild commit `b1a2adf` while preserving the rebuilt API, auth, onboarding, MSW, and dashboard behavior.

**Architecture:** Treat `b1a2adf` as the source of truth for design assets, layout, metadata, public pages, and dashboard visual primitives. Bring those files back as directly as possible, then adapt only the imports and data contracts that conflict with the current rebuilt functional layer.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, shadcn CSS helpers, Base UI, motion/react, lucide-react, TanStack Query, MSW.

---

### Task 1: Restore Design Baseline Files

**Files:**

- Restore: `app/globals.css`
- Restore: `app/opengraph-image.tsx`
- Restore: `app/(main)/layout.tsx`
- Restore: `app/(main)/page.tsx`
- Restore: `app/(static)/layout.tsx`
- Restore: `app/(static)/privacy/page.tsx`
- Restore: `app/(static)/terms/page.tsx`
- Restore: `components/layout/Navbar.tsx`
- Restore: `components/layout/Footer.tsx`
- Restore: `components/layout/PageTransition.tsx`
- Restore: `components/FooterGate.tsx`
- Restore: `components/NavbarGate.tsx`
- Restore: `components/realillust/primitives.tsx`
- Restore: `components/realillust/status-page.tsx`
- Restore: `components/realillust/status-panel.tsx`
- Remove conflicting simplified routes: `app/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`

- [ ] **Step 1: Copy the selected files from `b1a2adf`**

Run:

```bash
git checkout b1a2adf -- app/globals.css app/opengraph-image.tsx 'app/(main)' 'app/(static)' components/layout/Navbar.tsx components/layout/Footer.tsx components/layout/PageTransition.tsx components/FooterGate.tsx components/NavbarGate.tsx components/realillust
```

- [ ] **Step 2: Remove simplified route files that conflict with restored route groups**

Run:

```bash
rm app/page.tsx app/privacy/page.tsx app/terms/page.tsx
```

Expected: root, terms, and privacy routes are served through the restored route groups.

### Task 2: Restore Metadata, Assets, and Dependencies

**Files:**

- Modify: `app/layout.tsx`
- Restore: `public/favicon.ico`
- Restore: `public/favicon-16x16.png`
- Restore: `public/favicon-32x32.png`
- Restore: `public/apple-touch-icon.png`
- Restore: `public/android-chrome-192x192.png`
- Restore: `public/android-chrome-512x512.png`
- Restore: `public/site.webmanifest`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Restore assets and root layout from `b1a2adf`**

Run:

```bash
git checkout b1a2adf -- app/layout.tsx public/favicon.ico public/favicon-16x16.png public/favicon-32x32.png public/apple-touch-icon.png public/android-chrome-192x192.png public/android-chrome-512x512.png public/site.webmanifest
```

- [ ] **Step 2: Restore required design dependencies**

Run:

```bash
pnpm add @base-ui/react @hookform/resolvers @tanstack/react-query @vercel/analytics @vercel/speed-insights class-variance-authority clsx date-fns lucide-react motion nextjs-toploader react-hook-form shadcn tailwind-merge tw-animate-css zod zustand
pnpm add -D @faker-js/faker orval
```

Expected: restored layout and components can resolve design dependencies.

### Task 3: Restore Dashboard Visual Components Safely

**Files:**

- Restore/adapt: `components/ui/*`
- Restore/adapt: `components/dashboard/dashboard-shell.tsx`
- Restore/adapt: `components/dashboard/dashboard-sidebar.tsx`
- Restore: `components/dashboard/status-card.tsx`
- Restore: `components/dashboard/coming-soon-panel.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/layout.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/page.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/members/page.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/settings/page.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/usage/page.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/webhooks/page.tsx`

- [ ] **Step 1: Restore reusable dashboard design components from `b1a2adf`**

Run:

```bash
git checkout b1a2adf -- components/ui components/dashboard/dashboard-shell.tsx components/dashboard/dashboard-sidebar.tsx components/dashboard/status-card.tsx components/dashboard/coming-soon-panel.tsx
```

- [ ] **Step 2: Keep rebuilt server route behavior where required**

Inspect current route files and restored component props. Keep `getOrganizationForSsr` and current `OrganizationDetail` flow intact so dashboard routes continue to fetch organization data through the rebuilt API layer.

### Task 4: Restore API Key Design Without Losing Current Behavior

**Files:**

- Restore/adapt: `app/dashboard/[organizationPublicId]/api-keys/api-key-actions.ts`
- Restore/adapt: `app/dashboard/[organizationPublicId]/api-keys/api-key-helpers.ts`
- Restore/adapt: `app/dashboard/[organizationPublicId]/api-keys/api-keys-manager.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/api-keys/api-keys-table.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/api-keys/create-api-key-dialog.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/api-keys/rename-api-key-dialog.tsx`
- Restore/adapt: `app/dashboard/[organizationPublicId]/api-keys/revoke-api-key-dialog.tsx`
- Modify: `app/dashboard/[organizationPublicId]/api-keys/page.tsx`
- Remove or replace: `components/dashboard/api-key-manager.tsx`

- [ ] **Step 1: Restore the pre-rebuild API key UI files**

Run:

```bash
git checkout b1a2adf -- 'app/dashboard/[organizationPublicId]/api-keys'
```

- [ ] **Step 2: Adapt server actions to current API endpoints**

Use the current `lib/api/endpoints.ts` and `lib/api/generated.ts` types rather than restoring the deleted generated Orval client.

### Task 5: Verify and Publish

**Files:**

- Modify as needed: `docs/rebuild/final-web-parity-verification.md`

- [ ] **Step 1: Format**

Run:

```bash
pnpm format:check
```

Expected: PASS, or run `pnpm format` and recheck.

- [ ] **Step 2: Lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Smoke test rendered routes**

Run:

```bash
NEXT_PUBLIC_API_MOCKING=enabled NEXT_PUBLIC_API_BASE_URL= pnpm dev --port 3001
curl -I http://localhost:3001/
curl -I http://localhost:3001/terms
curl -I http://localhost:3001/privacy
curl -I http://localhost:3001/dashboard
curl -I http://localhost:3001/opengraph-image
```

Expected: public routes and metadata routes return successful responses, and dashboard entry renders or redirects according to auth state.

- [ ] **Step 5: Commit, push, and open PR**

Run:

```bash
git add .
git commit -m "feat: restore pre-rebuild design parity (#26)"
git push -u origin feat/26/restore-design-parity
gh pr create --base dev --head feat/26/restore-design-parity --title "feat: restore pre-rebuild design parity (#26)" --body-file /tmp/realillust-web-pr-26.md
```

Expected: PR targets `dev` and contains `## Related Issues` with `- Closes #26`.
