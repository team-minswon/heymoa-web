---
name: heymoa-new-component
description: |
  Use when creating a new UI component for the HeyMoa web app.
  Ensures design system compliance, proper token usage, and component architecture patterns.
  Trigger on: new component creation, UI element requests, "컴포넌트 생성", shadcn/ui component additions.
---

# HeyMoa New Component Skill

## When to Use
- Creating a new reusable UI component
- Adding a shadcn/ui component via `pnpx shadcn@latest add <component>`
- Building a feature-specific component that needs to follow the design system

## Component Architecture

### Directory Structure
```
components/
├── ui/           # shadcn/ui primitives (auto-generated, minimal edits)
├── heymoa/       # HeyMoa-specific compound components
├── auth/         # Authentication-related components
├── layout/       # Layout components (Navbar, Footer, PageTransition)
└── mocks/        # Development-only components (MockProvider)
```

### When to use which directory:
- **`ui/`** — Low-level primitives from shadcn/ui. Add via CLI, customize minimally.
- **`heymoa/`** — Business-logic components composed from `ui/` primitives. Custom to HeyMoa.
- **`auth/`** — Authentication flow components only.
- **`layout/`** — Page structure components only.

## Design Token Rules

### MUST use `--el-*` variables. Never inline hex colors.

| Purpose | Class/Style |
|---|---|
| Page background | `bg-[var(--el-canvas)]` |
| Card background | `bg-white` or `bg-[var(--el-surface-card)]` |
| Alternate section bg | `bg-[var(--el-canvas-soft)]` |
| Primary text | `text-[var(--el-ink)]` |
| Body text | `text-[var(--el-body)]` |
| Muted text | `text-[var(--el-muted)]` |
| Border | `border-[var(--el-hairline)]` |
| Strong border | `border-[var(--el-hairline-strong)]` |
| Card shadow | `shadow-[0_4px_16px_rgba(0,0,0,0.04)]` |
| Primary button | `bg-[var(--el-primary)] text-white rounded-full` |
| Outline button | `border border-[var(--el-hairline-strong)] rounded-full bg-transparent` |

### Typography Classes
- Display heading: `font-serif font-light tracking-tight`
- Title: `font-semibold text-[var(--el-ink)]`
- Body: `text-[15px] text-[var(--el-body)] tracking-[0.16px]`
- Caption: `text-[14px] text-[var(--el-muted)]`
- Section label: `text-[12px] font-semibold tracking-wider uppercase`

### Border Radius
- CTA buttons: `rounded-full` (pill)
- Cards: `rounded-2xl` (16px)
- Inputs: `rounded-lg` (8px-12px)
- Icon circles: `rounded-full`

## Adding a shadcn/ui Component
```bash
pnpx shadcn@latest add <component-name>
```
This adds to `components/ui/`. After adding:
1. Review the generated file
2. Ensure it uses the design tokens from `globals.css` (it should, via CSS variables)
3. If heavy customization is needed, create a wrapper in `components/heymoa/` instead

## Pattern: Composing with Primitives
Use `PageSection` and `Panel` from `components/heymoa/primitives.tsx`:

```tsx
import { PageSection, Panel } from "@/components/heymoa/primitives";

export function MyFeature() {
  return (
    <PageSection className="py-24">
      <Panel>
        <h2 className="font-serif font-light text-3xl text-[var(--el-ink)]">
          Title
        </h2>
      </Panel>
    </PageSection>
  );
}
```

## Verify
```bash
pnpm lint && pnpm build
```
