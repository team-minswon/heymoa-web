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

|           | 마케팅(랜딩·약관)              | 제품(워크스페이스 이후)                                  |
| --------- | ------------------------------ | -------------------------------------------------------- |
| 색 토큰   | `--el-*` (공유)                | `--el-*` (공유)                                          |
| 폰트      | Inter + EB Garamond (공유)     | Inter + EB Garamond (공유)                               |
| 셸/캔버스 | off-white, 96px 리듬, pill CTA | 각진 셸(radius 0) · hairline · 여백 0으로 뷰포트 꽉 채움 |
| 그림자    | 단일 티어 `0 4px 16px/0.04`    | 2연타 e2/e3 (아래)                                       |
| 조판      | 대문자 키커 + 세리프 300 제목  | **대문자 키커 금지** · 세리프 300 제목만 정체성으로 유지 |

### 고도 — 셸은 각지고 레이어만 둥글다

`globals.css` 토큰. raw `shadow-[...]` 대신 유틸을 쓴다.

| 층                          | 토큰 / 유틸 | 값                                           | 쓰임                                 |
| --------------------------- | ----------- | -------------------------------------------- | ------------------------------------ |
| 셸(App Panel·사이드바·메인) | — (없음)    | radius 0 · 그림자 없음 · hairline            | 사이드바/메인은 항상 함께 사는 한 셸 |
| e2 부양                     | `shadow-e2` | `0 2px 4px #0c0a090f, 0 10px 28px #0c0a091c` | 챗봇 카드 · 플로팅 독 · FAB          |
| e3 오버레이                 | `shadow-e3` | `0 4px 8px #0c0a0914, 0 20px 56px #0c0a092b` | 노트 시트 · 다이얼로그 · 드롭다운    |

그림자는 2연타다 — 짧고 진한 접지 + 길고 옅은 앰비언트. 카드 안의 카드(요약 블록·목록 행)에는 그림자 금지, hairline만.

**설정·인박스 다이얼로그는 이 표를 안 지킨다.** `0 24px 64px -12px #0c0a0938, 0 2px 6px #0c0a0914`를
raw `shadow-[...]!`로 쓴다(`settings-dialog-shell.tsx:69`, 정본 8장 동일). `shadow-e3`가
tailwind-merge에 안 지워져서 우회한 자리인데, **우회하면서 값까지 바꿨다.** 우회가 필요하면
`shadow-e3`의 값을 그대로 적어야 한다. 스크림도 갈라져 있다 — 이 8장만 `#0c0a09/25`,
나머지 모달(새 프로젝트·삭제 확인·회의 종료·노트 시트) 8장은 `#0c0a09/10`. 규칙이 없다.

### 우측 레일 — 표면마다 규칙이 다르다 (2026-08-02)

레일(개인 에이전트 · 공유 챗)은 `fixed`라 본문을 덮는다. **밀지 말지가 표면마다 다르다.**

| 표면 | 레일 | 본문 | 닫기 |
|---|---|---|---|
| 워크스페이스 목록 | 본문 **위에 쌓인다** | 안 좁힌다 (1188 유지) | 있다 |
| 노트 사이드뷰 | **열 수 없다** | — | — |
| 노트 전체 화면 | **상주** — 기본으로 서 있다 | 좁히고 10px 틈 | **없다** |

노트 전체 화면은 본문과 챗이 늘 같이 있는 화면이라 접을 자리를 주지 않는다. 사이드뷰는
860 안에 시트와 레일이 같이 못 들어간다(D12) — 목록에서 열어 둔 채 들어와도 감춘다.

**숫자 셋이 한 세트다.** 하나만 바꾸면 겹치거나 틈이 벌어진다.

```
레일 폭 440   personal-chat.tsx  ·  note-panel.tsx
본문 좁힘 470  workspace-app-shell.tsx   = 좌여백 10 + 우여백 10 + 440 + 레일 우여백 10
결과          본문 10..980 · 레일 990..1430 · 틈 10 (셸의 다른 여백과 같다)
```

이 값이 **490이었고 패널 자기 여백 20을 빠뜨려 레일이 본문을 10px 덮었다.** 본문의 오른쪽
hairline과 radius 16이 레일 밑에 깔리고 표의 마지막 열이 잘렸다. 정본 19장이 그 상태를
그대로 베껴 놓아서 실측으로도 안 잡혔다 — **둘이 같이 틀리면 픽셀 대조가 통과한다.**

### 형태 스케일 (5단계 · 역할 기반)

| 유틸              | 값     | 쓰임                                           |
| ----------------- | ------ | ---------------------------------------------- |
| `rounded-panel`   | 16px   | 패널·다이얼로그                                |
| `rounded-block`   | 10px   | 블록 카드                                      |
| `rounded-control` | 8px    | 컨트롤·목록 행                                 |
| `rounded-chip`    | 6px    | 칩·배지                                        |
| `rounded-full`    | 9999px | circle(아바타·아이콘) · pill(주 CTA·레코더 독) |

`rounded-full`은 circle과 pill 두 역할만. 셸은 각짐(0). 마케팅의 `{rounded.xl}` 카드 규칙은 제품에 쓰지 않는다.

### 타이포 스케일

| 유틸                | 값   | 쓰임                     |
| ------------------- | ---- | ------------------------ |
| `text-screen-title` | 34px | 화면 제목 (세리프 300)   |
| `text-note-title`   | 26px | 노트 제목 (세리프 300)   |
| `text-section`      | 20px | 섹션 제목                |
| `text-panel-title`  | 18px | 패널 제목                |
| `text-read`         | 15px | 전사 본문 · 목록 행 제목 |

14 이하는 **Tailwind 기본이 아니다.** 제품 면은 아래 4단을 쓴다 — 이 화면 밀도에서
`text-sm`(14)/`text-xs`(12) 둘로는 「행 제목 / 탭 / 보조 / 키커」 네 층이 구분되지 않는다.

| 값 | 개수 | 쓰임 |
|---|---|---|
| 13px | 779 | 목록 행 제목 · 폼 라벨 · 사이드바 nav |
| 12px | 1,567 | 탭 · 상태 칩 · 챗 본문 |
| 11px | 1,807 | 보조 설명 · 메타 · 캡션 |
| 10px | 231 | 대문자 키커 · 배지 숫자 |

**2026-08-02 에 정했다.** 그전까지 이 표는 「Tailwind 기본을 쓴다」였고 정본·코드 둘 다 안
지키고 있었다 — 화면을 재서 코드를 맞추는 픽셀 대조 루프가 이 표를 통째로 우회했기 때문이다.
문서 한 쪽만 틀린 상태였으므로 **정본을 정답으로 삼고 문서를 고쳤다.**

`text-[13px]` 같은 임의값을 계속 쓴다. 유틸로 뽑지 않은 이유는 네 값이 역할과 1:1이 아니라서다 —
같은 12px 이 탭에도 칩에도 챗 본문에도 앉는다. 이름을 붙이면 그 이름이 거짓말을 한다.

사다리 밖 예외 둘은 의도다. 확인 다이얼로그 제목 16px(2곳) · 아바타 스택의 `+1` 9px(7곳,
20px 원 안에 들어가야 한다).

### 아이콘 · 아바타 사다리

| | 값 | 쓰임 |
|---|---|---|
| 아이콘 | 12 · 14 · 16 · 20 · 32 | 12=인라인 메타, 14=사이드바 보조, 16=기본, 20=강조, 32=아이콘 버튼 |
| 아바타 | 20 · 24 · 28 · 40 | 20=행 안 중첩, 24=목록 기본, 28=사이드바·헤더, 40=프로필 |

사다리 밖 값은 대개 측정 사고다. 실제로 설정 다이얼로그의 15px 아이콘이 그렇게 들어왔다
(아래 「0.95배 사고」).

### ~~사다리 밖 값~~ — 닫았다 (2026-08-02)

설정 6면 + 인박스 다이얼로그 8장에만 사다리 밖 값이 있었다. **전부 되돌렸다.**

| 무엇 | 개수 | → | 근거 |
|---|---|---|---|
| `11.5` | 27 | **11** | 같은 다이얼로그의 `11/normal` 24개와 같은 역할 |
| `12.5` | 3 | **12** | 같은 인박스의 `12/500`(「전부 읽음」) |
| `10.5` | 2 | **11** | 다이얼로그의 보조 텍스트 계열 |
| `14.5` | 8 | **15** | 사다리 값. 섹션 제목 13보다 위 |
| 아이콘 `15` | 42 | **16** | 사다리 12/14/16/20/32 |
| 세리프 weight `normal` | 7 | **300** | 코드의 `font-serif` 27곳 중 여기만 달랐다 |

**되돌릴 값은 0.95 나눗셈이 아니라 「같은 다이얼로그 안의 같은 역할이 쓰는 정수」로 정했다.**
0.95 가설(20→19 · 16→15.2 · 15→14.25 · 13→12.35 · 12→11.4 · 11→10.45)은 여섯이 여섯 다
맞았지만 상자 치수는 깨끗한 정수라 **표면 전체가 축소 측정된 건 아니다** — 원인은 끝내
확정하지 못했다. 파일 안에 있는 이웃 값이 추론보다 확실한 근거였다.

**남는 교훈**: 소수점 픽셀은 거의 항상 측정 사고다. `text-[11.5px]` 같은 값이 보이면
디자인 판단인지 묻지 말고 같은 화면의 같은 역할이 뭘 쓰는지 먼저 센다.

### 접근성 — 토큰이 만든 실패 (2026-08-01)

디자인 파일 전수 측정에서 텍스트 대비 미달 **214건**이 나왔고 원인은 토큰 하나였다.

| 토큰 | 값 | white | canvas `#f5f5f5` | 칩 `#f0efed` | 비활성 `#e7e5e4` |
|---|---|---|---|---|---|
| `--el-muted` (전) | `#777169` | 4.83 | **4.43** | **4.20** | **3.84** |
| `--el-muted` (후) | `#6b655c` | 5.77 | 5.29 | 5.02 | 4.59 |

`#777169` 는 **흰 배경에서만** 통과한다. 필터 탭·사이드바 메타·챗 상태처럼 캔버스나 칩 위에 앉는
문자열이 전부 미달이었다. 값 하나를 내려 214건이 닫혔다.

**컨트롤 경계는 hairline 으로 못 만든다.** WCAG 1.4.11 은 3:1 을 요구하는데
`--el-hairline`(`#e7e5e4`)은 흰 배경에서 **1.26** 이다. 테두리만으로 경계를 만드는
outline 버튼·입력에는 `--el-control-border`(`#8d877e`, white 3.56 · canvas 3.27)를 쓴다.
**행 구분선은 hairline 그대로다** — 거기엔 3:1 이 필요 없다.

**에러는 3단 램프다.** 라이브 상태(사이드바 「기록 중」)가 `--el-error-strong`(`#c41f1f`) 텍스트 +
`--el-error-bg`(`#fef2f2`) 틴트를 쓴다. 디자인 파일에만 있던 값을 토큰으로 승격했다.

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
