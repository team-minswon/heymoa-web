---
name: heymoa-design-sync
description: |
  Use when DESIGN.md has been updated with new design tokens, colors, typography, or component specs.
  Synchronizes the design system specification to CSS variables and component implementations.
  Trigger on: DESIGN.md changes, color/font/spacing token updates, "디자인 변경", "토큰 변경" mentions.
---

# HeyMoa Design Sync Skill

## When to Use
- `DESIGN.md` has been modified with new tokens or component specs
- CSS variables need to sync with the design document
- Components need to be updated to follow new design rules
- New gradient orb colors, typography scales, or border-radius tokens are added

## Design System Architecture

### Token Flow
```
DESIGN.md (source of truth)
    ↓
app/globals.css (CSS custom properties: --el-*)
    ↓
Tailwind @theme (maps --el-* to Tailwind utilities)
    ↓
Components (use --el-* via inline styles or Tailwind classes)
```

### Variable Namespace
- **`--el-*`** — Primary namespace for all ElevenLabs-derived design tokens
- **`--clay-*`** — Legacy backward-compat aliases (map to `--el-*`). Do NOT use in new code.

## Workflow

### Step 1: Read the DESIGN.md diff
Identify which tokens changed. Map each `{token.ref}` to its CSS variable:

| DESIGN.md Token | CSS Variable |
|---|---|
| `{colors.primary}` | `--el-primary` |
| `{colors.canvas}` | `--el-canvas` |
| `{colors.surface-card}` | `--el-surface-card` |
| `{colors.hairline}` | `--el-hairline` |
| `{colors.ink}` | `--el-ink` |
| `{colors.body}` | `--el-body` |
| `{colors.muted}` | `--el-muted` |
| `{colors.gradient-mint}` | `--el-gradient-mint` |
| `{colors.gradient-peach}` | `--el-gradient-peach` |
| `{colors.gradient-lavender}` | `--el-gradient-lavender` |
| `{colors.gradient-sky}` | `--el-gradient-sky` |
| `{colors.gradient-rose}` | `--el-gradient-rose` |

### Step 2: Update `app/globals.css`
- Update the hex values in the `:root` block
- Update the Tailwind-to-CSS mappings if structural changes occurred
- Keep backward-compat `--clay-*` aliases pointing to new `--el-*` values

### Step 3: Update affected components
Search for any component using the changed token and verify visual correctness:
```bash
grep -r "var(--el-" components/ app/ --include="*.tsx" -l
```

### Step 4: Typography Rules
- **Display headlines**: `font-serif font-light` (EB Garamond, weight 400 loaded but used at `font-light` for visual 300 effect)
- **Body text**: `font-sans` (Inter via Geist), `tracking-[0.16px]`
- **CTA buttons**: `text-[15px] font-medium rounded-full`
- **Section labels**: `text-[12px] font-semibold tracking-wider uppercase`

### Step 5: Verify
```bash
pnpm build
```
Then visually check `pnpm dev` in browser.

## Do's and Don'ts (from DESIGN.md)

### Do
- Use `--el-primary` (ink pill) for primary CTAs only
- Use `font-serif font-light` for every display headline
- Use atmospheric gradient orbs as decoration only
- Use pill shape (`rounded-full`) for every CTA and badge

### Don't
- Don't introduce saturated brand action colors
- Don't bold display copy (stays at font-light)
- Don't use gradient orbs as button fills or text colors
- Don't use sharp corners (`rounded-none`) on CTAs
- Don't drop body Inter to weight 300

## Key Files
- `DESIGN.md` — Design system specification (source of truth)
- `app/globals.css` — CSS custom properties and Tailwind theme
- `app/layout.tsx` — Font loading (EB_Garamond, Geist, Geist_Mono)
- `components/heymoa/primitives.tsx` — `PageSection` and `Panel` base components
