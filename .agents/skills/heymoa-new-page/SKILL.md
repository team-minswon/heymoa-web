---
name: heymoa-new-page
description: |
  Use when creating a new page or route in the HeyMoa web app.
  Ensures App Router conventions, metadata setup, sitemap/robots updates, and design system compliance.
  Trigger on: new page creation, new route requests, "페이지 추가", "라우트 생성" mentions.
---

# HeyMoa New Page Skill

## When to Use
- Creating a new page under `app/` using Next.js App Router
- Adding a new route that needs metadata, SEO, and design system compliance

## Checklist

### 1. Route Structure
- Pages go in `app/(main)/` for pages with Navbar/Footer
- Pages go in `app/(static)/` for legal/static content (simplified footer)
- Auth pages go in `app/auth/`
- File: `page.tsx` for the route, `layout.tsx` if custom layout needed

### 2. Metadata
Every page MUST export a `Metadata` object:
```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "페이지 제목",
  alternates: {
    canonical: "/route-path",
  },
};
```

For private pages (settings, dashboard), add:
```typescript
robots: { index: false, follow: false },
```

### 3. Design System Compliance
- Page wrapper: use `<PageSection>` from `@/components/heymoa/primitives`
- Display headings: `font-serif font-light text-3xl sm:text-4xl text-[var(--el-ink)]`
- Body text: `text-[15px] text-[var(--el-body)] tracking-[0.16px]`
- Cards: `rounded-2xl border border-[var(--el-hairline)] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]`
- Primary CTA: `rounded-full bg-[var(--el-primary)] text-white`
- Section spacing: `py-24` (96px) between major sections

### 4. SEO Updates
- Add the route to `app/sitemap.ts` if it should be indexable
- Check `app/robots.ts` — add to `disallow` if it's a private page
- If needed, update `lib/auth/paths.ts` `allowedReturnPaths` set

### 5. Navigation Updates
- If the page should appear in nav, update `components/layout/Navbar.tsx`
- If the page should appear in footer, update `components/layout/Footer.tsx`
- If the page should hide nav/footer, update `components/NavbarGate.tsx` / `components/FooterGate.tsx`

### 6. Verify
```bash
pnpm lint && pnpm build
```

## Key Files
- `app/(main)/page.tsx` — Example of a main content page
- `app/(main)/settings/page.tsx` — Example of an authenticated page
- `app/(static)/layout.tsx` — Static page layout
- `app/sitemap.ts` — Sitemap generation
- `app/robots.ts` — Crawler rules
- `lib/auth/paths.ts` — Allowed return-to paths
