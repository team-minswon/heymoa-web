## Overview

ElevenLabs reads like a quietly editorial print magazine that happens to be a voice-AI product. The base canvas is off-white `{colors.canvas}` (#f5f5f5) holding warm near-black ink `{colors.ink}` (#0c0a09). The brand voltage is **photographic, not chromatic**: soft pastel atmospheric gradient orbs (mint, peach, lavender, sky, rose) drift through the page as the only "color" moments. There is no neon accent, no saturated CTA color, no dark-canvas dev-tools atmosphere.

Type pairs **Waldenburg Light** (custom serif at weight 300) for display with **Inter** for body, navigation, captions. The display weight at 300 is the editorial signature — never bold, never heavy.

CTAs are subtle: a near-black ink pill (`{component.button-primary}`) is the primary, a transparent outline (`{component.button-outline}`) is the secondary. The brand trusts atmospheric photography and modest type weights to carry brand work.

**Key Characteristics:**

- Off-white canvas, warm near-black ink. No saturated CTA color.
- Single primary action: ink pill at `{rounded.pill}`. Atmospheric gradients carry visual brand voltage.
- Display runs Waldenburg Light at weight 300 — editorial magazine voice.
- Body runs Inter at 400 with subtle letter-spacing (+0.15-0.18px).
- Pastel gradient orbs (5 tokens: mint, peach, lavender, sky, rose) used as atmospheric brand decoration only.
- Soft pill geometry (`{rounded.pill}` for CTAs, `{rounded.xl}` for cards).
- 96px section rhythm.

> **이 문서는 두 면을 기술한다.** 아래 Colors~Responsive는 **마케팅 면**(랜딩·약관 — off-white 캔버스, pill CTA, 그라데이션 오브, 단일 티어 그림자)의 규칙이다. **제품 면**(워크스페이스 이후 — 각진 셸, 2연타 고도, 형태 스케일 5단계)은 별도 규칙을 따른다 — [`## Product Surface (제품 면 · v5)`](#product-surface-제품-면--v5)를 본다. 색 토큰(`--el-*`)과 폰트(Inter/EB Garamond)는 두 면이 공유한다.

## Colors

### Brand & Accent

- **Ink Primary** (`{colors.primary}` — #292524): The primary action color — warm near-black pill. Used scarcely.
- **Ink Primary Active** (`{colors.primary-active}` — #0c0a09): Press state.

### Surface

- **Canvas** (`{colors.canvas}` — #f5f5f5): Off-white page floor.
- **Canvas Soft** (`{colors.canvas-soft}` — #fafafa): Lighter band for subtle alternating sections.
- **Canvas Deep** (`{colors.canvas-deep}` — #0c0a09): Same as ink — used for the rare dark-mode hero (Agents page).
- **Surface Card** (`{colors.surface-card}` — #ffffff): Pure white card.
- **Surface Strong** (`{colors.surface-strong}` — #f0efed): Badges, voice-icon plates.
- **Surface Dark** (`{colors.surface-dark}` — #0c0a09): Dark hero/CTA band canvas.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` — #1c1917): Cards on dark canvas.

### Hairlines

- **Hairline** (`{colors.hairline}` — #e7e5e4): Default 1px divider.
- **Hairline Soft** (`{colors.hairline-soft}` — #f0efed): Lighter divider.
- **Hairline Strong** (`{colors.hairline-strong}` — #d6d3d1): Stronger panel outline.

### Text

- **Ink** (`{colors.ink}` — #0c0a09): Display, primary text.
- **Body** (`{colors.body}` — #4e4e4e): Default running-text.
- **Body Strong** (`{colors.body-strong}` — #292524): Same as primary — emphasis.
- **Muted** (`{colors.muted}` — #777169): Sub-titles.
- **Muted Soft** (`{colors.muted-soft}` — #a8a29e): Disabled text.
- **On Primary** (`{colors.on-primary}` — #ffffff): White text on ink pill.
- **On Dark** (`{colors.on-dark}` — #ffffff): White text on dark hero.
- **On Dark Soft** (`{colors.on-dark-soft}` — #a8a29e): Muted off-white on dark.

### Atmospheric Gradient Stops (signature)

- **Gradient Mint** (`{colors.gradient-mint}` — #a7e5d3): Mint green orb.
- **Gradient Peach** (`{colors.gradient-peach}` — #f4c5a8): Peach orb.
- **Gradient Lavender** (`{colors.gradient-lavender}` — #c8b8e0): Lavender orb.
- **Gradient Sky** (`{colors.gradient-sky}` — #a8c8e8): Sky-blue orb.
- **Gradient Rose** (`{colors.gradient-rose}` — #e8b8c4): Rose orb.

These appear ONLY as soft radial-gradient atmospheric orbs inside `{component.gradient-orb-card}` and as background atmospheric blooms behind hero copy. Never as button fills, never as text colors.

### Semantic

- **Success** (`{colors.semantic-success}` — #16a34a): Confirmation.
- **Error** (`{colors.semantic-error}` — #dc2626): Validation errors.

## Typography

### Font Family

**Waldenburg Light** is the licensed display serif at weight 300. **Inter** carries body, navigation, captions, and buttons. Fallback: `'Times New Roman', serif` for Waldenburg, `sans-serif` for Inter.

### Hierarchy

| Token                            | Size | Weight | Line Height | Letter Spacing | Use                      |
| -------------------------------- | ---- | ------ | ----------- | -------------- | ------------------------ |
| `{typography.display-mega}`      | 64px | 300    | 1.05        | -1.92px        | Homepage hero h1         |
| `{typography.display-xl}`        | 48px | 300    | 1.08        | -0.96px        | Subsidiary heroes        |
| `{typography.display-lg}`        | 36px | 300    | 1.17        | -0.36px        | Section heads            |
| `{typography.display-md}`        | 32px | 300    | 1.13        | -0.32px        | Sub-section heads        |
| `{typography.display-sm}`        | 24px | 300    | 1.2         | 0              | Card group titles        |
| `{typography.title-md}`          | 20px | 500    | 1.35        | 0              | Component titles — Inter |
| `{typography.title-sm}`          | 18px | 500    | 1.44        | 0.18px         | List labels              |
| `{typography.body-md}`           | 16px | 400    | 1.5         | 0.16px         | Default body — Inter     |
| `{typography.body-strong}`       | 16px | 500    | 1.5         | 0.16px         | Emphasized body          |
| `{typography.body-sm}`           | 15px | 400    | 1.47        | 0.15px         | Footer body              |
| `{typography.caption}`           | 14px | 400    | 1.5         | 0              | Photo captions           |
| `{typography.caption-uppercase}` | 12px | 600    | 1.4         | 0.96px         | Section labels, badges   |
| `{typography.button}`            | 15px | 500    | 1.0         | 0              | CTA pill                 |
| `{typography.nav-link}`          | 15px | 500    | 1.4         | 0              | Top-nav menu             |

### Principles

- **Display weight stays at 300.** Waldenburg Light is the editorial signature. Never bold display copy.
- **Subtle letter-spacing on body.** Inter at +0.15-0.18px tracking — slightly looser than default Inter for a more editorial feel.
- **Negative letter-spacing on display.** Waldenburg pulls -0.32px to -1.92px tighter on display sizes.

### Note on Font Substitutes

Waldenburg is licensed. Open-source substitute: **EB Garamond** at weight 300 (slightly more humanist) or **GT Sectra** (closer to Waldenburg's modernity). Use Inter directly for body — it's the same family ElevenLabs uses.

## Layout

### Spacing System

- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.base}` 16px · `{spacing.md}` 20px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- **Section padding:** 96px.

### Grid & Container

- Max content width: ~1200px.
- Editorial body: 12-column grid.
- Feature card grids: 2-up at desktop for hero splits, 3-up for benefit grids.
- Footer: 5-column at desktop.

### Whitespace Philosophy

Generous editorial pacing — print-magazine feel. 96px between bands; cards inside bands sit close (16-24px gap). The atmospheric gradient orbs occupy generous breathing space without competing with copy.

## Elevation & Depth

The system uses **hairline + soft drop**. Cards float above the off-white canvas via 1px hairlines and a single subtle shadow tier. Atmospheric depth comes from gradient orbs.

| Level           | Treatment                                         | Use                                      |
| --------------- | ------------------------------------------------- | ---------------------------------------- |
| Flat (canvas)   | `{colors.canvas}` (#f5f5f5)                       | Body bands, footer                       |
| Card            | `{colors.surface-card}` (#ffffff)                 | Content cards                            |
| Hairline border | 1px `{colors.hairline}`                           | Card outlines                            |
| Soft drop       | `0 4px 16px rgba(0, 0, 0, 0.04)`                  | Hovered cards (single shadow tier)       |
| Gradient orb    | Radial gradient with one of `{colors.gradient-*}` | Atmospheric depth — never a card surface |

### Decorative Depth

- **Pastel gradient orbs** are the brand's strongest atmospheric pattern. Soft radial blooms in mint, peach, lavender, sky, or rose drift through hero bands and feature sections without containing any content — they are pure atmosphere.

## Shapes

### Border Radius Scale

| Token            | Value  | Use                             |
| ---------------- | ------ | ------------------------------- |
| `{rounded.none}` | 0px    | Reserved                        |
| `{rounded.xs}`   | 4px    | Inline tags                     |
| `{rounded.sm}`   | 6px    | Compact rows                    |
| `{rounded.md}`   | 8px    | Form inputs                     |
| `{rounded.lg}`   | 12px   | Compact cards                   |
| `{rounded.xl}`   | 16px   | Feature cards, pricing tiers    |
| `{rounded.xxl}`  | 24px   | Gradient orb cards (extra-soft) |
| `{rounded.pill}` | 9999px | All CTA buttons, badges         |
| `{rounded.full}` | 9999px | Voice icon circles, avatars     |

## Components

### Top Navigation

**`top-nav`** — Background `{colors.canvas}`, text `{colors.ink}`, height 64px. Layout: ElevenLabs wordmark left, primary horizontal menu (Creative / Agents / Video / Pricing / Enterprise / Docs), Sign In + "Try free" primary CTA right.

### Buttons

**`button-primary`** — Near-black ink pill. Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}` (15px / 500), padding 10px × 20px, height 40px, rounded `{rounded.pill}`.

**`button-primary-active`** — Press state. Background `{colors.primary-active}`.

**`button-outline`** — Transparent pill with 1px ink border. Background transparent, text `{colors.ink}`, 1px `{colors.hairline-strong}` border.

**`button-tertiary-text`** — Inline ink text link.

### Hero & Atmospheric

**`hero-band`** — Background `{colors.canvas}`, full-width display headline in `{typography.display-mega}` (64px / 300 / -1.92px), subhead in `{typography.body-md}`, two CTAs, and an atmospheric gradient orb behind the centered headline.

**`gradient-orb-card`** — A large card with a soft radial-gradient orb behind centered display copy. Background `{colors.canvas-soft}`, rounded `{rounded.xxl}` (24px), padding 32px. Each variant uses one of the five gradient tokens (`gradient-mint`, `gradient-peach`, `gradient-lavender`, `gradient-sky`, `gradient-rose`).

**`audio-waveform-card`** — A waveform visualization card. Background `{colors.surface-card}`, rounded `{rounded.xl}`, padding 24px. Holds a play button + waveform glyph + voice metadata.

### Cards

**`feature-card`** — 2-up or 3-up grids. Background `{colors.surface-card}`, text `{colors.ink}`, rounded `{rounded.xl}`, padding 24px, 1px hairline border.

**`product-card-stack`** — Stacked product preview cards. Background `{colors.surface-card}`, rounded `{rounded.xl}`, no padding (children fill the card edge-to-edge).

**`testimonial-card`** — Quote card. Background `{colors.surface-card}`, text `{colors.body}`, rounded `{rounded.xl}`, padding 32px.

### Voice Library

**`voice-row`** — Horizontal row in voice list. Background transparent, 1px hairline divider. Layout: 32px circular voice icon (`{component.voice-icon-circular}`) left, voice name + accent stack, optional preview button right.

**`voice-icon-circular`** — Background `{colors.surface-strong}`, rounded `{rounded.full}`, 32px diameter. Holds initials or voice glyph.

### Pricing

**`pricing-tier-card`** — Background `{colors.surface-card}`, rounded `{rounded.xl}`, padding 32px, 1px hairline border.

**`pricing-tier-featured`** — Featured tier inverts. Background `{colors.surface-dark}`, text `{colors.on-dark}`. Same shape, dark inversion.

### Forms & Tags

**`text-input`** — Background `{colors.surface-card}`, text `{colors.ink}`, rounded `{rounded.md}` (8px), padding 12px × 16px, height 44px, 1px `{colors.hairline-strong}` border. On focus, border thickens to 2px ink.

**`badge-pill`** — Background `{colors.surface-strong}`, text `{colors.ink}`, type `{typography.caption-uppercase}`, rounded `{rounded.pill}`, padding 4px × 10px.

### CTA / Footer

**`cta-band`** — Pre-footer. Background `{colors.canvas}`, centered display headline in `{typography.display-lg}`, single ink pill CTA. 96px padding.

**`footer`** — Closing footer. Background `{colors.canvas}`, text `{colors.body}`. 5-column link list. 64×48px padding.

**`footer-link`** — Background transparent, text `{colors.body}`, type `{typography.body-sm}`.

## Do's and Don'ts

### Do

- Reserve `{colors.primary}` (ink pill) for primary CTAs.
- Use Waldenburg Light at weight 300 for every display headline. Never bold.
- Use Inter at +0.15-0.18px tracking for body — the editorial dialect.
- Use atmospheric gradient orbs (mint/peach/lavender/sky/rose) as decoration only.
- Use the pill shape for every CTA and badge.

### Don't

- Don't introduce a saturated brand action color. Ink pill is the only CTA color.
- Don't bold display copy. Display sits at weight 300 — bolding shifts the brand voice from editorial to consumer-marketing.
- Don't use gradient orbs as button fills, text colors, or component backgrounds. They are pure atmosphere.
- Don't use sharp `{rounded.none}` (0px) on CTAs. Pill geometry is the brand button.
- Don't drop body Inter to weight 300 to match Waldenburg — body stays at 400/500 for legibility.
- Don't extract a CTA color from a third-party widget (cookie consent, OneTrust). The brand's CTA color is what appears on actual product CTAs.

## Responsive Behavior

### Breakpoints

| Name    | Width       | Key Changes                                                               |
| ------- | ----------- | ------------------------------------------------------------------------- |
| Mobile  | < 640px     | Hero h1 64→32px; feature cards 1-up; nav hamburger; gradient orbs shrink. |
| Tablet  | 640–1024px  | Hero h1 48px; feature cards 2-up.                                         |
| Desktop | 1024–1280px | Full hero h1 64px; feature cards 3-up.                                    |
| Wide    | > 1280px    | Content caps at 1200px.                                                   |

### Touch Targets

- Primary pill at 40px height — at WCAG AA, padded for AAA.
- Voice icon circles 32px — padded row creates effective 48px tap zone.

### Collapsing Strategy

- Top nav switches to hamburger below 768px.
- Feature grid: 3-up → 2-up → 1-up.
- Gradient orbs reduce diameter at every breakpoint but never disappear.

## Product Surface (제품 면 · v5)

워크스페이스에 들어간 뒤의 화면(사이드바·노트 상세·챗봇·알림·설정)은 마케팅 면과 다른 규칙을 따른다. **왜 다른가:** 마케팅은 흰 배경 위 잡지 조판이고, 제품은 회색 캔버스 위에서 실제로 뜨고 지는 레이어를 구분해야 한다. 마케팅 단일 티어 그림자(`0 4px 16px rgba(0,0,0,0.04)`)는 회색 캔버스에서 안 보인다. 정본 수치는 `docs/design/v5-spec-notes.md`의 SPEC 노트이며, 여기서는 코드 토큰과의 대응만 못박는다.

### 공유하는 것 / 나뉘는 것

| | 마케팅(랜딩·약관) | 제품(워크스페이스 이후) |
| --- | --- | --- |
| 색 토큰 | `--el-*` (공유) | `--el-*` (공유) |
| 폰트 | Inter + EB Garamond (공유) | Inter + EB Garamond (공유) |
| 셸/캔버스 | off-white, 96px 리듬, pill CTA | 각진 셸(radius 0) · hairline · 여백 0으로 뷰포트 꽉 채움 |
| 그림자 | 단일 티어 `0 4px 16px/0.04` | 2연타 e2/e3 (아래) |
| 조판 | 대문자 키커 + 세리프 300 제목 | **대문자 키커 금지** · 세리프 300 제목만 정체성으로 유지 |

### 고도 — 셸은 각지고 레이어만 둥글다

`globals.css` 토큰. raw `shadow-[...]` 대신 유틸을 쓴다.

| 층 | 토큰 / 유틸 | 값 | 쓰임 |
| --- | --- | --- | --- |
| 셸(App Panel·사이드바·메인) | — (없음) | radius 0 · 그림자 없음 · hairline | 사이드바/메인은 항상 함께 사는 한 셸 |
| e2 부양 | `shadow-e2` | `0 2px 4px #0c0a090f, 0 10px 28px #0c0a091c` | 챗봇 카드 · 플로팅 독 · FAB |
| e3 오버레이 | `shadow-e3` | `0 4px 8px #0c0a0914, 0 20px 56px #0c0a092b` | 노트 시트 · 다이얼로그 · 드롭다운 |

그림자는 2연타다 — 짧고 진한 접지 + 길고 옅은 앰비언트. 카드 안의 카드(요약 블록·목록 행)에는 그림자 금지, hairline만.

### 형태 스케일 (5단계 · 역할 기반)

| 유틸 | 값 | 쓰임 |
| --- | --- | --- |
| `rounded-panel` | 16px | 패널·다이얼로그 |
| `rounded-block` | 10px | 블록 카드 |
| `rounded-control` | 8px | 컨트롤·목록 행 |
| `rounded-chip` | 6px | 칩·배지 |
| `rounded-full` | 9999px | circle(아바타·아이콘) · pill(주 CTA·레코더 독) |

`rounded-full`은 circle과 pill 두 역할만. 셸은 각짐(0). 마케팅의 `{rounded.xl}` 카드 규칙은 제품에 쓰지 않는다.

### 타이포 스케일

| 유틸 | 값 | 쓰임 |
| --- | --- | --- |
| `text-screen-title` | 34px | 화면 제목 (세리프 300) |
| `text-note-title` | 26px | 노트 제목 (세리프 300) |
| `text-section` | 20px | 섹션 제목 |
| `text-panel-title` | 18px | 패널 제목 |
| `text-read` | 15px | 전사 본문 · 목록 행 제목 |

14 이하(탭·채팅·메타·힌트)는 Tailwind 기본(`text-sm`/`text-xs`)을 그대로 쓴다.

## Iteration Guide

1. Focus on a single component at a time.
2. CTAs default to `{rounded.pill}`. Cards use `{rounded.xl}` (16px).
3. Variants live as separate entries.
4. Use `{token.refs}` everywhere — never inline hex.
5. Hover state never documented.
6. Waldenburg 300 for display, Inter 400/500 for body.
7. Gradient orbs scoped to atmospheric decoration.

## Known Gaps

- Waldenburg is a licensed typeface; EB Garamond / GT Sectra are documented substitutes.
- Animation timings (orb drift, waveform pulse, hero entrance) out of scope.
- In-product surfaces (voice library editor, agent playground) only partially captured via marketing mockups.
- Form validation states beyond focus not visible on captured surfaces.
