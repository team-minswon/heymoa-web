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

> **이 문서는 두 면을 기술한다.** 아래 Colors~Responsive는 **마케팅 면**(랜딩·약관 — off-white 캔버스, pill CTA, 그라데이션 오브, 단일 티어 그림자)의 규칙이다. **제품 면**(워크스페이스 이후 — 캔버스 위에 뜬 둥근 패널 셸, 2연타 고도, 형태 스케일 5단계)은 별도 규칙을 따른다 — [`## Product Surface (제품 면 · v5)`](#product-surface-제품-면--v5)를 본다. 색 토큰(`--el-*`)과 폰트(Inter/EB Garamond)는 두 면이 공유한다.

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

### 한글 세리프 (2026-08-03)

**`font-serif`는 두 폰트의 스택이다** — 라틴은 EB Garamond, 한글은 **Noto Serif KR 300**. 이 제품의 화면은 거의 전부 한글인데 EB Garamond에는 한글 글리프가 없어서, `font-serif`를 준 제목이 전부 시스템 산세리프로 떨어져 있었다. 세리프 300을 정체성으로 적어 두고 화면에는 평범한 고딕이 나온 상태였다.

순서가 곧 글리프 폴백 순서다(`--font-serif: EB Garamond, Noto Serif KR, serif`). 뒤집으면 라틴까지 Noto가 가져가 「HeyMoa」의 라틴 조판이 바뀐다.

CJK라 `preload: false`로 받는다. 서브셋이 수백 개로 쪼개져 있어 preload를 켜면 쓰지 않을 조각까지 끌어온다 — unicode-range로 필요한 조각만 받게 둔다.

디스플레이 크기의 음수 자간(-1.4 ~ -3.4px)은 두 폰트 모두에 그대로 적용된다. 한글은 라틴보다 글자폭이 균일해 같은 값에서 더 조밀하게 읽히지만, 정본(`design.pen`)이 한글 기준으로 잡은 값이라 그대로 쓴다.

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

### 랜딩 (design.pen `UWqm8` · 2026-08-03)

정본은 `heymoa/design/design.pen`의 `/ · 기본 (비로그인)` 프레임이다. **그 파일은 이 저장소 밖이고 git에도 없다** — 셸 프레임과 같은 규약이라, 구현이 대조할 대상은 아래 표다. 1440 기준 실측이고, 좌우 여백은 전 구간 64다(`px-6 sm:px-10 lg:px-16`).

| 밴드 | 기하 · 조판 |
| --- | --- |
| Hero | 높이 720. 배지(pill · 12/600 · 자간 0.8) → 34 → H1 `104/106 · 세리프 300 · -3.4` → 30 → 본문 `18/32` → 36 → CTA 둘(pill h48) → 18 → 잔글 13 |
| Proof | 상하 48. 3열, 2·3열 앞에 세로 hairline. `01` 세리프 15 → 제목 세리프 30 → 설명 `14/23` |
| Missions | 상하 104 · 배경 `--el-surface-strong`. 머리 `52/59 · -1.4`, 행마다 hairline. 번호 17 · 제목 `28/35` · 본문 `14/25` |
| Features | 상하 104. 4열, 각 열 앞 세로 hairline + 왼쪽 20. 아이콘 18 → 제목 세리프 24 → 설명 `13/23` |
| CTA | 높이 480. `68/75 · -2.2` → 20 → `17/30` → 32 → pill |

그라데이션 오브의 위치·크기도 정본을 따른다. 값은 1440×720(CTA는 1440×480) 기준 좌표를 **비율로** 옮긴 것이라 폭이 달라져도 구도가 유지된다.

**정본과 갈린 것 셋.** 이유가 서로 달라 따로 적는다. **셋 다 정본을 코드에 맞췄다** — 문서와 정본이 서로 다른 말을 하지 않게, 어긋난 쪽을 그때그때 한 방향으로 정리한다.

- **제품 샷(`v9rBG2`)** — 안 그린다. 정본에서도 지웠다.
- **상단바** — 캔버스에 붙은 평평한 바(높이 76)로 그려져 있었지만, 실제는 루트 레이아웃의 떠 있는 알약(`fixed top-4` · `976 × 62` · 흰색 70% + blur 12)이다. **정본을 알약으로 바꿨고**, 히어로는 `pt-32`(데스크톱 `pt-20`)로 그 몫을 비운다 — 안 비우면 배지가 알약에 가린다.
- **푸터** — 한 줄로 그려져 있었지만 실제는 5단(브랜드·문의 / 서비스 / 정책 + 하단 저작권 줄, 높이 326)이다. **정본을 그 5단으로 바꿨다.**

상단바·푸터는 랜딩 밖(약관·초대·환영)에서도 같은 것을 쓰므로 랜딩 하나 때문에 갈아 끼우지 않는다.

정본 상단바의 「보안」 메뉴는 **가리킬 섹션이 없다** — 없는 섹션을 지어내지 않았고 링크도 두지 않았다. 남은 앵커는 `#features`와 `#how-it-works`(Proof 밴드) 둘이다.

### 마케팅 면의 움직임

랜딩은 `motion/react`로 들어온다. 히어로는 마운트 즉시, 나머지 밴드는 뷰포트에 들어올 때 **한 번만**(`viewport.once`) 올라온다 — 스크롤을 되돌릴 때마다 다시 튀면 읽는 흐름이 끊긴다.

| 값 | |
| --- | --- |
| 기본 전이 | `y 20 → 0` · `opacity 0 → 1` · 800ms · `cubic-bezier(0.16, 1, 0.3, 1)` |
| 자식 간격 | 120ms |
| 시작 지점 | 뷰포트 아래 100px (`margin: "-100px"`) |

**`MotionConfig reducedMotion="user"`로 감싼다.** motion의 기본값은 `"never"`라 이게 없으면 OS의 「동작 줄이기」를 무시한다.

앵커 이동은 `scroll-behavior: smooth`를 `html`에 걸지 않고 **버튼의 `scrollIntoView`로** 한다 — 전역으로 걸면 라우트 이동의 「맨 위로 복귀」까지 애니메이션이 붙는다. 대상 섹션은 `scroll-mt-24`로 떠 있는 상단바 몫을 비운다.

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

|           | 마케팅(랜딩·약관)              | 제품(워크스페이스 이후)                                  |
| --------- | ------------------------------ | -------------------------------------------------------- |
| 색 토큰   | `--el-*` (공유)                | `--el-*` (공유)                                          |
| 폰트      | Inter + EB Garamond + Noto Serif KR (공유) | 좌동                                          |
| 셸/캔버스 | off-white, 96px 리듬, pill CTA | 회색 캔버스 위에 **뜬 둥근 패널**(radius 16) · 거터 10 · hairline |
| 그림자    | 단일 티어 `0 4px 16px/0.04`    | 2연타 e2/e3 (아래)                                       |
| 조판      | 대문자 키커 + 세리프 300 제목  | **대문자 키커 금지** · 세리프 300 제목만 정체성으로 유지 |

### 셸 프레임 — 캔버스 위에 뜬 패널 (design.pen 정본)

**셸은 뷰포트를 꽉 채우지 않는다.** 회색 캔버스(`--el-canvas` `#f5f5f5`) 위에 사이드바가 배경·테두리 없이 그냥 앉고, 본문만 둥근 흰 패널로 뜬다. 사이드바와 패널이 `border-r` 하나로 붙어 있던 예전 「한 셸」이 아니다.

**수치의 정본은 아래 표다.** 값이 나온 곳은 `heymoa/design/design.pen`이지만 **그 파일은 이 저장소 밖이고 git에도 없다**(Pencil 전용 포맷 · 10MB). fresh checkout에서는 열 수 없으므로 노드 ID는 출처 표시일 뿐이고, 구현이 대조할 대상은 이 표와 `e2e/smoke.spec.ts`의 「keeps the shell frame geometry from design.pen」이다 — 그 테스트가 아래 값을 실제로 잰다. `docs/design/v5-spec-notes.md`가 같은 이유로 같은 규약을 쓴다.

아래는 뷰포트 1440×900 기준 실측값이다.

| 화면 | 출처 노드 | 기하 |
| --- | --- | --- |
| 워크스페이스 | `IUax1` · `BviA2` | 사이드바 `232 · left 0` (투명) → 틈 `10` → 패널 `1188 × 880 · left 242 · top 10`. 거터 사방 10 |
| 노트 사이드 뷰 | `u3yYCX` | 시트 `860 × 884 · left 572 · top 8` (거터 8). 뒤에 scrim `--el-ink` 10% |
| 노트 전체 뷰 | `XtEMZ` + `L4PpR` | 본문 + 에이전트 레일 `440` (오른쪽 고정) |

패널 공통: `rounded-panel`(16) · `border 1px --el-hairline` · `bg --el-surface-card` · `shadow-e2`. 상단바는 `56`이고 배경 없이 아래 hairline만 갖는다.

**사이드바 테두리는 primitive에서 뺐다.** `group-data-[side=left]:border-r`이 특이도 (0,2,0)이라 호출부의 `border-r-0`(0,1,0)으로는 못 지운다 — 선이 필요한 쪽이 붙인다.

### 빈 워크스페이스의 두 빈 상태 (design.pen `kbUlG` / `O7yCDv` · 2026-08-06)

**빈 상태는 하나가 아니라 둘이다.** 예전에는 하나였고 문구가 "상단바의 **새 노트**로 첫 회의를 시작하면…"이었는데, 프로젝트가 없으면 그 버튼이 비활성이라 **가리키는 곳이 눌리지 않았다.** 무엇을 먼저 해야 하는지는 화면 어디에도 없었고, 유일한 입구인 사이드바 「프로젝트 만들기」는 왼쪽 아래에 있어 절차의 1단계로 읽히지 않았다.

| 상태 | 정본 | 제목 | 단계 카드 | CTA |
| --- | --- | --- | --- | --- |
| 프로젝트 0 | `kbUlG` | 회의를 담을 프로젝트부터 | 프로젝트 만들기 → 회의 만들기 → 기록하고 요약 확인 | 첫 프로젝트 만들기 |
| 프로젝트 있음 · 회의 0 | `O7yCDv` | 첫 회의를 기록해 보세요 | 회의 만들기 → 기록 시작 → 요약 확인 | 새 회의 만들기 |

**프로젝트 0에서는 제목·개수·필터를 통째로 걷는다.** 「0개의 회의 기록」과 「전체 / 내가 시작」은 걸러 볼 것이 있다는 뜻인데 여기엔 아무것도 없다. 회의 0에서는 그 크롬을 남긴다 — 프로젝트를 골라 보는 것이 이미 의미 있는 상태다.

**CTA는 1단계 하나만 가리킨다.** 카드가 하는 일은 다음에 무엇이 오는지 보여 주는 것이고, 지금 누를 것은 아래 버튼 하나다. 둘을 나란히 두면 어느 쪽이 먼저인지 다시 헷갈린다.

#### 만들기 창은 셸이 소유한다

입구가 셋이다 — 사이드바 머리글 `+`, 상단바 「새 노트」, 빈 상태 CTA. 그중 「새 노트」는 **프로젝트가 없으면 프로젝트 창을 먼저 열고, 만든 뒤 회의 창으로 이어져야** 하므로 두 창이 한 자리에 있어야 이어 붙는다. 그래서 `workspace-app-shell`이 둘 다 들고 `openCreateProject` / `requestNewMeeting`을 컨텍스트로 내보낸다. 이름 변경은 사이드바가 계속 갖는다(대상이 있는 조작이라 입구가 하나뿐이다).

이어 붙이는 것은 **첫 프로젝트뿐이다.** 사이드바 `+`로 만드는 둘째·셋째 프로젝트에는 이어 붙일 이유가 없다 — 그때는 이미 회의를 만들어 본 사람이다.

정본 `kbUlG`의 1단계 라벨은 「회의 만들기」였고 2단계와 같은 말이었다(프레임 이름만 「프로젝트 만들기」였다). CTA도 이름은 「첫 프로젝트 만들기」인데 라벨은 「새 회의 만들기」였다. 둘 다 고쳤다.

### 노트의 두 겹 크롬 — 상단바 + 노트 헤더 (design.pen `KktRX`+`MZRO0` / `Sghjz`+`c5cQ8n` · 2026-08-06)

노트 면의 크롬은 **두 줄이고 뜻이 다르다.** 한때 한 헤더에 다 몰아넣었더니 좁은 폭에서 그 줄이 감기며 세로로 자라 전사 높이를 0까지 밀어냈다(812×375 landscape에서 헤더 278/355 실측).

| 층 | 높이 | 무엇 |
| --- | --- | --- |
| 상단바 | `56` 고정 | `← 목록으로` · `확장`/`축소` · 구분선 `1×18` · 제목 `13/600` 빵조각 … 오른쪽 `⋯ 노트 메뉴`(삭제) |
| 노트 헤더 | 내용 | 상태 칩 + 프로젝트 pill → 세리프 제목 `34/300` → 아바타 스택 + 메타 두 줄 … 오른쪽 `회의 종료` |

**상단바는 두 뷰 다 있다.** 전체 뷰는 워크스페이스 상단바를 통째로 덮고, 사이드 뷰 시트도 목록 위에 떠서 뒤의 바를 누를 수 없다 — 나갈 길이 여기밖에 없다. 그래서 **별도 「노트 닫기」 버튼은 없앴다**(같은 곳으로 가는 길이 둘이었다).

**hairline은 탭 줄 하나만 갖는다.** 정본은 제목과 탭이 선 하나로 닫힌 한 덩어리다 — 헤더에도 선을 두면 같은 블록에 줄이 두 개 그어진다.

**정본의 알림 벨은 뺐다**(`Tc3e6` 등 14개 화면 → `⋯ 더보기`로 교체). 노트 안에서 알림을 여는 흐름이 기획에 없고, 열면 이 면 위에 팝오버가 또 뜬다. 전체 뷰에는 워크스페이스 상단바가 없어 삭제 메뉴가 갈 곳이 그 자리뿐이다.

#### 상태 칩과 메타 두 줄

상태 칩은 `6px` 점(기록 중·종료됨) 또는 아이콘(시작 전 `calendar` · 중지됨 `pause`)에 `11/600` 라벨이다. **기록 중만 붉다** — 나머지는 사건이 아니라 상태다. 기록 중인데 시작자가 아니면 `[eye] 참관` 칩이 옆에 서서 **회의 제어가 없는 이유**를 말한다. 라벨은 `MEETING_STATUS_LABEL`을 그대로 쓴다(목록 행과 같은 이름) — 정본이 「예정」이라 적은 것은 목록이 「시작 전」으로 부르는 같은 상태다.

메타 두 줄의 아래 줄은 **상태마다 다른 질문에 답한다.** 시작 전에는 「언제 시작하나」, 기록 중에는 「누가 보나(참관이면 누가 기록 중인가)」, 끝난 뒤에는 「얼마나 기록됐나」다. 한 줄로 합치면 어느 상태에서도 절반이 군더더기다. 정본의 `워크스페이스 멤버 4명 공개`에서 수는 뺐다 — 그 수는 계약에 없고 위 줄이 이미 참석자 수를 말한다.

**초 단위로 바뀌는 값과 얼굴은 헤더에 없다.** 누적 기록 시간과 진행자는 정보 탭이, 진행 중 라이브 타이머는 레코더 독(`qYRCW`)이 갖는다. 헤더는 분 단위 요약만 그린다(「기록 42분 (종료 세션 누적)」).

#### 탭은 세그먼트 컨트롤이다

`bg --el-surface-strong` · `rounded-control`(8) · `p-1`에 칩(`rounded-chip`(6) · `h-8` · `px-3` · `12/500`) 하나가 흰 카드로 뜬다. 전체폭 밑줄 탭이 아니고 **왼쪽에 `w-fit`으로 붙는다** — 탭이 셋~넷뿐인데 860 폭에 균등 분할하면 라벨 사이가 200px씩 벌어져 한 뭉치로 안 읽힌다. 라벨은 `정보 / 전사 / 요약`(+ 사이드 뷰의 `챗봇`)이고 뷰·상태로 갈리지 않는다.

primitive의 기본 높이가 `group-data-horizontal/tabs:h-8`이라 **호출부도 같은 variant로 덮어야 한다**(`group-data-horizontal/tabs:h-10`). 평범한 `h-10`은 tailwind-merge가 충돌로 보지 않아 조용히 32px로 남는다.

#### 본문 좌우 여백은 면이 정한다

정본은 사이드 시트(860)에 좌우 `100`을, 전체 뷰 본문(970)에 좌우 `64`를 준다 — 같은 노트인데 값이 다르다. 그래서 노트 패널 루트가 `--note-gutter`를 선언하고 헤더·전사·요약·정보·아카이브가 그것을 읽는다(`px-[var(--note-gutter)]`). 각자 하드코딩하면 뷰를 바꿀 때마다 네 군데가 어긋난다. 좁은 화면은 두 뷰가 같다(`20` → `sm` `36`).

읽기 폭 상한은 `max-w-[calc(820px+2*var(--note-gutter))]`다. **`max-w-[820px]`이면 안 된다** — 그 상한은 padding box에 걸려서 거터가 안쪽으로 먹고, 사이드 뷰에서 실제 여백이 `120`으로 벌어진다(실측).

### 에이전트 레일의 두 탭 (design.pen `L4PpR` · 2026-08-03)

전체 뷰 오른쪽 `440`은 위에서부터 **탭(높이 64) → 범위 한 줄(36) → 대화**다.

| 탭 | 범위 문구 | 무엇 |
| --- | --- | --- |
| 이 회의 | 「참여자 전원이 함께 봅니다」 | 공유 챗봇. 회의가 살아 있을 때만 보낼 수 있고, 종료·미시작이면 자물쇠가 붙는다 |
| 내 에이전트 | 「나만 보는 대화 · 워크스페이스 범위」 | 개인 챗봇 |

**탭이 있는 이유는 회의가 끝나기 때문이다.** 공유 챗봇은 살아 있는 회의에 붙은 것이라 종료되면 컴포저가 잠긴다. 노트 안에서는 개인 챗봇을 떠 있는 카드로 띄우지 않으므로(레일 위에 겹친다), 탭이 없으면 **종료된 회의에는 물어볼 곳이 한 군데도 없었다.**

「내 에이전트」는 레일이 새로 그리지 않는다 — 셸이 이미 들고 있는 개인 챗봇 패널을 이 자리로 **포털**해 온다. 새로 그리면 같은 스코프의 세션이 두 벌이 되고, 옮기면서 언마운트하면 흐르던 답변이 사라진다. 포털은 컴포넌트를 제자리에 두고 DOM만 옮기므로 스트림을 쥔 훅이 살아남는다.

레일에 들어간 패널은 **자기 껍데기를 내려놓는다** — 테두리·radius·그림자는 레일이 갖고, **닫기 버튼은 없다**(탭이 자리를 가르므로 닫을 곳이 없다).

두 탭 모두 **감출 뿐 언마운트하지 않는다.** 탭을 옮길 때 끊으면 계약상 부분 응답은 저장되지 않아 흐르던 답변이 통째로 사라진다. 자리를 넘기는 것도 **「내 에이전트」를 고른 동안만**이다 — 늘 넘기면 노트를 전체 화면으로 열기만 해도 개인 챗봇이 마운트되어 조회가 걸린다. 대신 한 번 넘겨받으면 셸이 「연 것」으로 기억해서, 레일을 떠나도(축소·닫기·뒤로가기) 패널이 언마운트되지 않는다.

**좁은 화면(`lg` 미만)에서는 대화만 접고 탭 줄은 남긴다.** 레일 레인이 14rem이라 회의가 죽어 있을 때까지 세우면 전사 높이가 0이 되지만(모바일 landscape 실측), 통째로 감추면 「내 에이전트」를 고를 버튼까지 감춰져 종료된 회의에는 들어갈 길이 없어진다. 접힌 레일은 탭 줄 높이만 차지하고, 「내 에이전트」를 고르면 펼쳐진다. 개인 답변이 흐르는 동안에도 접지 않는다 — 중지도 도구 승인도 그 안에만 있다.

**노트 전체 뷰는 뷰포트를 통째로 쓴다.** 사이드바도 워크스페이스 상단바도 덮는다 — `fixed inset-0`이고 그 안에서 노트(왼쪽) + 에이전트 레일 `440`(오른쪽 **고정 · 닫기 없음**)이 캔버스 `10`으로 갈린다. 그래서 **회의 제어·창 제어·삭제 메뉴를 노트가 직접 갖는다**(예전에는 상단바의 노트 액션 슬롯이 맡았다) — 자리는 위 「노트의 두 겹 크롬」이 정한다.

덮인 크롬은 **`inert`로 포커스에서도 뺀다** — 시각적으로만 가리면 Tab이 보이지 않는 사이드바·목록 행으로 들어가고 Enter로 이동이 실행된다. 모바일 사이드바는 포털 시트라 `inert`가 안 닿으므로 진입 시 실제로 닫는다. 다른 노트를 녹음 중일 때 뜨는 상단 필(`z-50`)만 예외로 살아 있어야 한다.

**캔버스 틈과 패널 껍데기는 `lg`부터다.** 좁은 화면에서는 두 면이 테두리로 붙고, 레일도 회의가 살아 있을 때만 선다 — 그러지 않으면 14rem 레인이 전사 높이를 0으로 눌렀다(812×375에서 실측).

**사이드바 테두리는 primitive에서 뺐다.** `group-data-[side=left]:border-r`이 특이도 (0,2,0)이라 호출부의 `border-r-0`(0,1,0)으로는 못 지운다 — 선이 필요한 쪽이 붙인다.

### 제품 면의 움직임 (2026-08-03)

제품 면은 `motion/react`를 쓰지 않는다. **층이 뜨고 지는 것만** CSS 전이로 200ms `ease-out`이고, 그 안의 내용은 움직이지 않는다.

| 무엇 | 어떻게 |
| --- | --- |
| 에이전트 챗 패널 | `opacity 0→1` · `translate-x 16→0`. 닫으면 역방향 |
| 그 FAB | `opacity 0→1` · `scale 0.9→1`. 패널과 반대 위상 |
| 노트 전체 뷰 진입 | `opacity 0→1` · `scale 0.98→1` · `origin-right`. **들어올 때만** |

**챗 패널은 언마운트하지 않는다** — 흐르던 스트림을 끊으면 계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다. 그래서 감추기는 `display:none`이 아니라 `visibility:hidden`이고, **`visibility`를 전이 목록에 넣는 것이 핵심이다.** `visibility`는 전이 중 `visible`로 계산되고 끝에서만 뒤집혀서, 들어올 때는 즉시 보이고 나갈 때는 끝까지 보인다. 그러면서 끝 상태에서는 포커스·접근성 트리에서 실제로 빠진다.

FAB도 같은 이유로 상주한다. 조건부 렌더면 패널이 들어오는 동안 버튼만 즉시 증발한다. 감출 때 `aria-hidden`·`inert`·`tabIndex={-1}`을 함께 건다.

**전이 목록에 `transform`이 아니라 `translate`·`scale`을 적는다.** Tailwind v4는 `translate-x-4`를 개별 `translate` 속성으로 낸다 — `transform`만 적으면 투명도만 움직이고 위치는 튄다(실측으로 확인).

첫 마운트는 `starting:`(=`@starting-style`)이 맡는다. 챗 패널은 한 번 열기 전에는 아예 없고 전체 뷰 면은 라우트마다 새로 마운트되므로, 이게 없으면 첫 등장만 애니메이션이 빠진다.

**나갈 때(전체 뷰 → 사이드 뷰)는 애니메이션이 없다.** 전체 면은 즉시 언마운트되고 시트가 오른쪽에서 밀려 들어와 그 자리를 덮는다. 둘을 잇는 morph는 하지 않았다 — 서로 다른 컴포넌트라 값을 하나로 만들려면 노트 본문까지 한 트리에 묶어야 하고, 그건 스트림을 끊는 재마운트를 부른다.

**기하를 재는 테스트는 전이가 끝난 뒤에 잰다.** `e2e/smoke.spec.ts`가 `getAnimations()`의 `finished`를 기다린다 — 애니메이션 중에 재면 `scale(0.98)` 때문에 사방이 1px씩 안쪽으로 들어온 값이 나오고, 실제로 그렇게 잰 수치가 정본으로 굳은 적이 있다.

### 고도

`globals.css` 토큰. raw `shadow-[...]` 대신 유틸을 쓴다.

| 층                          | 토큰 / 유틸 | 값                                           | 쓰임                                 |
| --------------------------- | ----------- | -------------------------------------------- | ------------------------------------ |
| 셸 패널(사이드바 제외)      | `shadow-e2` | radius 16 · e2 · hairline                     | 워크스페이스 본문 패널 · 노트 전체 뷰 |
| e2 부양                     | `shadow-e2` | `0 2px 4px #0c0a090f, 0 10px 28px #0c0a091c` | 챗봇 카드 · 플로팅 독 · FAB          |
| e3 오버레이                 | `shadow-e3` | `0 4px 8px #0c0a0914, 0 20px 56px #0c0a092b` | 노트 시트 · 다이얼로그 · 드롭다운    |

그림자는 2연타다 — 짧고 진한 접지 + 길고 옅은 앰비언트. 카드 안의 카드(요약 블록·목록 행)에는 그림자 금지, hairline만.

### 형태 스케일 (5단계 · 역할 기반)

| 유틸              | 값     | 쓰임                                           |
| ----------------- | ------ | ---------------------------------------------- |
| `rounded-panel`   | 16px   | 패널·다이얼로그                                |
| `rounded-block`   | 10px   | 블록 카드                                      |
| `rounded-control` | 8px    | 컨트롤·목록 행                                 |
| `rounded-chip`    | 6px    | 칩·배지                                        |
| `rounded-full`    | 9999px | circle(아바타·아이콘) · pill(주 CTA·레코더 독) |

`rounded-full`은 circle과 pill 두 역할만. **셸 패널도 `rounded-panel`(16)이다** — 각진 셸(0)은 2026-08-02에 교체됐다(위 「셸 프레임」). 마케팅의 `{rounded.xl}` 카드 규칙은 제품에 쓰지 않는다.

### 타이포 스케일

| 유틸                | 값   | 쓰임                     |
| ------------------- | ---- | ------------------------ |
| `text-screen-title` | 34px | 화면 제목 (세리프 300)   |
| `text-note-title`   | 26px | 노트 제목 (세리프 300)   |
| `text-section`      | 20px | 섹션 제목                |
| `text-panel-title`  | 18px | 패널 제목                |
| `text-read`         | 15px | 전사 본문 · 목록 행 제목 |

14 이하(탭·채팅·메타·힌트)는 Tailwind 기본(`text-sm`/`text-xs`)을 그대로 쓴다.

### 코드와의 대응

이 문서의 값이 실제로 어디 사는지. **값의 원본은 코드이고 이 표는 지도다** — 어긋나면 코드를 따른다.

| 무엇 | 어디 |
|---|---|
| 색·형태·타이포 토큰 | `app/globals.css`의 `@theme inline`. CSS 변수는 `--el-*` 네임스페이스 |
| 토큰이 살아 있는지 | `lib/design-tokens.test.ts`가 존재를 지킨다. 지우면 테스트가 깨진다 |
| 세리프 300 제목 | `font-serif font-light` + 음의 tracking. 위 Hierarchy 표의 letter-spacing이 그 값이다 |

값 목록을 에이전트 rule로 복사하지 않는다. 매 세션 로드되는 목록은 천장이 되어 "이 안에서 고르면 된다"로 읽히고, 이 문서와 실제 앱 실측을 건너뛰게 만든다. 위반 감지는 `design-tokens.test.ts`와 codex 리뷰가 맡는다.

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
