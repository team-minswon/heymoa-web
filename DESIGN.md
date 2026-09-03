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

### 랜딩 (Claude Design 아트보드 · 2026-09-03)

정본은 **Claude Design 캔버스 두 장**이다 — 데스크톱 1440과 모바일 390. 「HeyMoa 랜딩 ·
사실 대조판」이고, 시안 다섯 중 이것만 고친다. 캔버스는 이 저장소 밖이라 구현이 대조할
대상은 아래 기준과 워크트리의 `.landing-ref/`(추적하지 않는 사본)이다.

**앞 판(design.pen `UWqm8`)은 폐기했다.** 그쪽은 그라데이션 오브와 세리프 104px 히어로였고,
지금 면은 크림 종이 위의 에디토리얼이다. 밴드 구성도 5에서 9로 늘었다. 옛 표를 남겨 두면
어느 쪽이 정본인지 갈리므로 지운다.

| 밴드 | 무엇 |
| --- | --- |
| Hero | 제목 · 본문 · CTA 둘 · 잔글 |
| 제품 샷 | 크림 매트(r24 · pad24) 위 흰 앱 창(r14). 상단바 · 전사 · 오른쪽 레일 |
| 작동 방식 | 흰 밴드. **머리글만 가운데 축.** 카드 셋(01/02/03)에 184px 창 |
| 사용 흐름 | 번호 여섯. 걸음마다 실제로 누르는 컨트롤을 옆에 |
| 왜 만드나 | 문제 셋. 각 줄에 「지금 되는 것」 상자(크림 `--lp-cream-soft`) |
| 기능 소개 | 카드 여섯(2열 3행 · 548×499). 크림 패널 위 244px 창 |
| 원칙 | 어두운 밴드 |
| FAQ | `<h3><button aria-expanded>` 다섯 |
| CTA | 히어로와 같은 버튼 쌍 |
| 푸터 | 파도 SVG(58) + 어두운 띠 |

**색은 `--lp-*`로 가른다.** 제품 면의 `--el-*`는 off-white 체계라 여기 쓰면 크림이 안 나오고,
크림을 전역에 두면 워크스페이스까지 물든다. `.landing-surface`가 범위를 자르고, 레이아웃
바깥에 사는 푸터는 `.landing-footer`로 값만 받는다. 원본은 `app/globals.css`다.

**흐린 값 둘을 나눠 둔다.** `--lp-faint`(#b5a698 · 2.2:1)는 목업 스크린샷 **안쪽**에서만
쓴다 — 앱 화면을 그린 삽화라 실제 앱의 색을 따른다. 페이지가 직접 하는 말은
`--lp-muted`(#7c6e62 · 4.65:1)를 쓴다. 둘을 바꿔 쓰면 본문이 대비를 잃는다.

**두 면은 행간·자간을 물려받지 않는다.** `body`의 0.16px 트래킹과 24px 행간은 제품 면의
값이라, 상속되면 명시 행간을 안 준 요소마다 몇 px씩 부푼다 — 「왜 만드나」의 칩 줄이 줄마다
7px 커져 섹션이 72px 밀렸다. `.landing-surface`·`.landing-footer`가 둘 다 `normal`로 되돌린다.

**정본과 갈린 것 셋.**

- **상단바** — 아트보드는 캔버스에 붙은 평평한 바(76)로 그렸지만 실제는 루트 레이아웃의
  떠 있는 알약(`fixed top-4` · 높이 62 · 바닥 78)이라 자리를 안 먹는다. **히어로의 위 여백은
  섹션 높이가 아니라 알약 바닥에서부터 잰다** — 78 + 아트보드의 96 = 174(모바일 78 + 60 = 138).
  킥커가 뷰포트 위 174에 서서 아트보드의 172와 2px 안에서 만난다. 섹션 높이만 비교하면 78px
  크게 나오는데, 그 몫이 정확히 아트보드가 바에게 내준 자리다.
- **푸터** — 아트보드의 어두운 파도 띠를 공용 `Footer`의 **전체 판**에 옮겨 그렸다. 그 판이
  뜨는 곳은 `app/(main)/`뿐이고 거기 있는 페이지는 `/` 하나라, 랜딩만 바뀐다. 약관·개인정보의
  축약 판(`simplified`)은 그대로 `--el-*`를 쓴다.
- **「왜 만드나」 셋째 줄** — 아직 없는 동작이라 라벨을 「방향」으로 적고 나침반 아이콘을
  쓴다. **상자 모양까지 가르지는 않는다** — 점선 테두리로 갈라 그렸다가 줄 하나만 미완성처럼
  보여 되돌렸다.

**제품 샷은 혼자 한 바퀴 돈다.** 화면에 들어오면 대본이 돌기 시작한다 — 말이 전사에 받아
적히고(말풍선 → 줄), 사건 흐름에 카드가 쌓이고, 에이전트가 답하고, 회의를 끝내면 요약이
나온다. 랜딩이 아래에서 글로 설명하는 차례를 화면이 먼저 한 번 보여 준다. 대본과 시간은
`use-demo.ts`에 있고 `product-shot.tsx`는 그 상태를 그리기만 한다.

- **앞으로만 간다.** 첫 렌더(= SSR = JS 끈 화면)가 대본의 시작이다 — 회의 다섯 줄이 이미
  적혀 있고 「기록 중」이다. 「끝난 화면을 그리고 되감는」 방식은 못 쓴다: 하이드레이션
  뒤에 되감으면 다 찬 전사가 한 프레임 보였다가 비는 것이 눈에 띈다.
- **손대면 탭만 고정한다.** 누르면 그 기둥의 탭이 그 자리에 못 박히고, **대본은 계속
  돈다.** 뺏지 말아야 할 것은 탭이지 내용이 아니다 — 누르자마자 화면이 딴 데로 가도 안
  되지만, 거기서 대본까지 끊으면 이번엔 보여 주려던 것이 통째로 사라진다(처음에 그렇게
  만들었다가 되돌렸다). 전사를 고른 사람은 줄이 계속 들어오는 것을 보고, 사건 흐름을 고른
  사람은 카드가 계속 쌓이는 것을 본다. **고정은 만진 기둥에만 건다** — 노트 탭을 눌렀다고
  레일까지 멈추지 않는다.
- **고정의 예외는 종료뿐이다.** 회의가 끝나면 앱이 요약 탭으로 넘긴다
  (`meeting-controls.tsx`의 `onMeetingEnded` → `note-panel.tsx`). 그 이동은 대본이
  부리는 것이 아니라 앱이 하는 일이라 방문자의 고정을 이긴다.
- **「회의 종료」는 종료 대목으로 건너뛴다.** 끝으로 감지 않는다 — 종료 뒤가 이 대본에서
  가장 볼 만한 대목이라(칩이 바뀌고 요약이 절 단위로 선다) 거기서부터 이어서 논다. 건너뛴
  말과 사건은 지나온 것으로 친다: 요약이 근거로 드는 시각(01:19)이 전사에 없으면 안 된다.
- **말풍선은 자리를 안 옮긴다.** 받아 적는 중인 줄은 확정된 줄과 **여백이 똑같고** 배경과
  모서리만 다르다(음수 여백이 안쪽 여백을 상쇄한다). 확정되면 색만 빠져서 글자가 한
  픽셀도 안 움직인다. 앱에는 이 중간 상태가 없다 — 전사는 확정된 것만 온다. 「말이 이렇게
  들어옵니다」를 보이려고 0.4초 두는 장면이다.
- **화면에 들어와야 시작한다.** 히어로를 읽는 동안 혼자 끝나 있으면 아무도 못 본다.
  한 번만 돈다.
- **모션을 줄였으면 아예 안 돌린다.** 처음부터 끝 상태다.
- **상태 문구는 앱 것 그대로다.** 「기록 중」만 붉고 종료는 muted다(`meeting-controls.tsx` —
  종료는 사건이 아니라 상태다). 요약 탭은 종료 전 「요약은 회의가 끝나면 생성됩니다」,
  종료 직후 「회의를 정리하고 있습니다」다(`note-summary.tsx`). 누적 기록 시간은 기록
  중에 아예 안 적는다(`note-details.tsx`).

**그리고 실제로 눌린다.** 정보·전사·요약과 실시간 정리·내 에이전트가 진짜 탭이고, 사건 범위
칩과 묶음 접기, 예시 질문, 회의 종료가 다 동작한다 — 그림만 보여 주는 것보다 앱이 어떤지가
훨씬 빨리 전해진다. `role="tablist"`와 방향키 이동(roving tabIndex)까지 앱과 같게 둔다:
버튼처럼 생겼는데 키보드로 못 쓰면 눌러 보라고 해 놓고 못 누르게 막는 셈이다.

「회의 종료」는 앱의 Meeting Bar가 그 버튼 하나뿐이라 같은 자리에 같은 모양으로 둔다. 앱은
여기서 확인 다이얼로그를 한 번 더 띄우지만(`meeting-end-dialog.tsx`) 그건 되돌릴 수 없는
일을 막는 장치라, 아무것도 안 지우는 이 그림에는 두지 않는다.

반대로 **흉내만 내는 것은 여전히 `<span>`이다** — 뒤로·전체화면·노트 메뉴·복사. 눌러도 할
일이 없는 것을 버튼으로 두면 탭 순회에 빈 정거장이 늘 뿐이다.

**「내 에이전트」에서는 실제로 묻는다.** 준비된 질문 셋을 칩으로 두고, 누르면 **먼저
생각하고**(0.62초) 답이 글자 단위로 흐른 뒤 참고한 회의록이 붙는다. 대화는 쌓이고 바닥에
붙어 따라간다.

- **자유 입력창을 열지 않았다.** 티로는 랜딩 입력창이 진짜 API를 친다. 우리는 비로그인
  질의를 받는 엔드포인트가 없어서, 입력창만 두면 아무 문장에나 준비된 답을 돌려주게 된다.
  「사실 대조판」을 내건 페이지가 첫 화면에서 그걸 하면 안 된다. 그래서 **답이 실제로 있는
  질문만** 낸다.
- **답은 이 회의에 있는 말만 쓴다.** 전사·요약·사건 흐름에서 짚을 수 있는 것뿐이다. 화면
  어디에도 없는 사실을 답하면 같은 약속을 다른 방식으로 어긴다.
- **칩 위에 「예시 질문」이라고 적는다.** 앱에는 이 줄이 없다 — 랜딩이 눌러 보라고 놓은
  것이라서, 라벨을 빼면 앱에 있는 기능처럼 읽힌다.
- **질문과 답이 같은 프레임에 서지 않는다.** 누르자마자 답이 뜨면 「이미 적혀 있던 글」로
  읽힌다. 그 사이에 앱과 같은 「생각하는 중」이 선다 — **스피너가 아니라 글자 위로 빛이
  지나간다**(`.lp-shimmer`, 앱 `ThinkingLine`의 `.chat-shimmer`와 같은 키프레임에 색만
  랜딩 토큰). 도는 원은 어디서나 도는 원이지만, 빛이 문장을 지나가면 그 문장이 지금 살아
  있다는 뜻이 된다.
- **근거는 답이 끝난 뒤에 선다.** 흐르는 중에 그리면 아직 안 읽은 회의록이 이미 붙은
  것처럼 보인다(앱도 `message_end` 뒤에 그린다).
- **흐르는 동안 답은 `aria-hidden`이다.** 글자마다 읽어 주면 한 문장을 수십 번 듣는다.
  다 흐르면 통째로 드러나 live 영역이 한 번 읽는다. 모션을 줄였으면 아예 안 흘린다.

**패널 높이는 고정한다**(1440에서 676, 390에서 372/532). 탭마다 길이가 달라서 그대로 두면
정보 탭을 누를 때 아래 밴드가 통째로 올라온다. 짧은 탭은 아래가 비지만 앱도 고정 높이
뷰포트라 그쪽이 실제에 가깝다.

**제품 샷은 아트보드가 아니라 실제 앱을 따른다.** 여기서만 정본이 뒤집힌다 — 이 랜딩의
전제가 「사실 대조판」인데, 시안의 목업은 앱을 대충 그려 놓았다. 실제와 어긋났던 것 넷:

**「기능 소개」 카드 목업도 같은 기준으로 고쳤다.** 승인 카드가 가장 많이 틀렸었다 — 앱은
도구 id(`linear.create_issue`)를 제목으로 쓰지 않는다. 그 자리에는 사람 말 요약이 들어가고
「쓰기 도구」 배지는 요약 **오른쪽**에 서며, 인자는 아래 `dl`로 붙는다
(`chat-thread.tsx`의 `ApprovalPrompt`). 질문 말풍선도 **오른쪽** 정렬이다(`justify-end`).

| 시안 | 실제 (`note-panel.tsx` · `context-rail.tsx` · `note-archive.tsx`) |
| --- | --- |
| 상단바가 창 전체를 가로지름 | **전사 기둥 안**에 산다(`h-14`). 레일은 제 헤더를 따로 이고 옆에 서고, 세로 선이 위에서 아래까지 가른다 |
| 정보·전사·요약이 알약 탭 | **밑줄 탭**(`TabsList variant="line"`). 알약은 레일 탭(실시간 정리 · 내 에이전트)뿐이다 |
| 시각 · 아바타 · (이름/본문) 한 줄 | **두 칸 격자** — 왼쪽 시각, 오른쪽에 화자 한 줄과 그 아래 본문(`grid-cols-[66px_1fr]`) |
| 묶음 머리에 사슬 아이콘 | `CONTEXT_KIND_ICON` 그대로 — 결정 `CircleCheck` · 할 일 `SquareCheck` · 질문 `CircleQuestionMark`. 머리와 카드가 같은 아이콘을 쓴다 |

크기는 앱의 0.85배다. 실제 값(본문 15/28)을 그대로 쓰면 여덟 줄이 창 높이를 넘는다.
그래서 이 밴드만 아트보드보다 크다(1440에서 932 vs 886, 390에서 1184 vs 1080).

**제품 샷은 좁은 화면과 넓은 화면이 다른 그림이다.** 1440은 크림 매트 위에 창 하나를 얹고
그 안을 전사와 레일로 나누지만, 390은 매트 안에 카드 **둘**을 세로로 쌓는다 — 390px에서 창
하나를 반으로 가르면 양쪽 다 못 읽는다. 전사도 여덟 줄에서 다섯 줄로 줄고, 레일 항목의 메타는
유형(「결정 ·」)을 뺀다. 바로 위 그룹 머리글이 이미 그 말을 한다. 구조가 달라서 한 트리에
`lg:` 덧칠로는 안 되고, 두 벌을 그려 `lg`로 가른다.

모바일 아트보드는 「왜 만드나」 상자를 흰 바탕 + 초록 라벨로 그렸는데 데스크톱 쪽만 크림으로
고쳐졌다. **데스크톱 쪽을 따른다** — 폭에 따라 상자 색이 바뀌는 것보다 낫다.

**카드 안 목업도 폭에 따라 다시 그린다.** 좁은 화면에서는 전사가 구분선 대신 8~9px 간격을
쓰고, 요약은 항목마다 가는 선 하나로 갈리며, 승인 카드는 버튼을 바닥에 붙이지 않는다 —
넓은 화면의 창은 184px로 고정이라 바닥선을 맞춰야 카드 셋이 줄을 서지만, 좁은 화면의 창은
내용만큼 자라서 붙일 바닥이 없다. 글자도 한 단 크다(10.5 → 11px): 350px 카드에서 10px는
안 읽힌다.

**아직 맞추지 못한 것.**

| 어디 | 차 | 왜 |
| --- | --- | --- |
| 히어로 (양쪽) | +78 / +78 | 아트보드가 바에게 내준 자리. 킥커의 눈높이는 2px 안에서 만난다 |
| 왜 만드나 (390) | −15 | 상자를 데스크톱 판(크림)으로 통일한 몫 |
| 사용 흐름 (390) | +21 | 모바일 아트보드는 5번 걸음의 「개요」 문장을 줄여 적고 4번 걸음에서 「오른쪽」을 뺀다. **폭에 따라 문장을 바꾸지 않았다** — 한 문장 때문에 문구를 두 벌로 들고 다닐 값이 아니다. 문장이 아닌 것(「마이크 입력」 라벨 등)은 폭에 따라 감춘다 |
| CTA (1440) | +4 | 15px 한 줄의 line box가 1px 다르다. 폰트 메트릭 차이라 더 좁힐 수 없다 |

1440은 제품 샷 · 작동 방식 · 기능 소개 · 원칙 · FAQ · 푸터가 아트보드와 같고 나머지가 ±2px다.
390은 제품 샷 · 원칙 · CTA · 푸터가 같고 나머지가 ±12px다(위 표의 둘은 뺀다).

**아트보드가 정하지 않은 폭은 768이다.** 「기능 소개」만 거기서 두 열로 갈린다(`md`) —
한 열이면 카드가 728px로 늘어나고, 그 안의 목업은 350px 카드에 맞춰 그린 11px 조판이라
텅 빈 판처럼 보인다. 두 열이면 카드가 357px로 시안의 350에 붙는다. 나머지 밴드는 1024
(`lg`)에서 갈린다.

**주 버튼에는 투명 테두리가 있다.** 강제 색상 모드(윈도우 고대비)는 배경색을 지우므로,
배경만 입은 버튼은 테두리가 없으면 맨 글자로 주저앉아 보조 버튼과 구분이 사라진다.
`border-transparent`가 그 모드에서 시스템 색으로 칠해진다. 시안에는 테두리가 없어 히어로가
2px 높아지지만, 그 대신 주·보조 버튼의 높이가 맞는다.

**폭 검증은 320 · 390 · 768 · 1440에서 했다.** 어느 폭에서도 가로 넘침 0, 잘리는 목업 0,
24px 미만 탭 타깃 0이다. 320은 1280을 400%로 확대한 폭이다(WCAG 1.4.10). 다크 모드는 앱에
아직 없어서 이 면도 그대로 뜬다 — `--lp-*`는 고정값이라 폰트 전환만으로 뒤집히지 않는다.

**접근성은 이 판에서 확인했다.** h1 하나 · 제목 단계 건너뜀 0 · 랜드마크 넷(header · nav ·
main · footer) · 포커스 링 없는 조작 요소 0 · 24px 미만 탭 타깃 0 · alt 없는 이미지 0 ·
이름 없는 조작 요소 0(21개 중).

**Tab으로 끝까지 걸어 봤다** — 정지 스무 곳, 전부 포커스 링이 있고 순서는 건너뛰기 링크 →
상단바 → 히어로 CTA → FAQ 다섯 → 닫는 CTA → 푸터다. 갇히는 곳도, 안 보이는데 포커스를
받는 곳도 없다. 접힌 FAQ 답과 반대 폭의 목업은 `display:none`이라 트리에서 빠진다
(제품 샷의 「3차 스프린트 킥오프」가 DOM에 둘, 보이는 것은 하나).
페이지가 직접 하는 말은 전부 4.5:1을 넘고, 기준 아래로 떨어지는 것은 13px 이하의 목업 내부
글자뿐이다 — 앱 화면을 따라 그린 삽화라 그렇게 둔다.

**앵커는 넷 다 `scroll-mt-24`를 갖는다**(`#features` · `#how-it-works` · `#why` · `#faq`).
떠 있는 상단바 바닥이 78이라 96을 비워야 딥링크로 들어온 사람이 제목부터 읽는다. 상단바와
푸터의 두 버튼은 앵커가 아니라 `scrollIntoView`인데, `scroll-margin`을 그쪽도 지킨다.

`<main>`에는 `tabIndex={-1}`을 준다 — 없으면 건너뛰기 링크가 해시만 바꾸고 포커스는 body에
남아 다음 Tab이 다시 nav로 돌아간다.

FAQ의 답은 **접혀도 DOM에 남긴다.** 지우면 `aria-controls`가 없는 id를 가리키고, 페이지 내
찾기도 접힌 답을 못 찾는다. `hidden`이라 높이는 0이다. 본문 건너뛰기 링크는
`focus-visible`이 아니라 `focus`로 뜬다 — 닿는 길이 키보드뿐이라 브라우저 휴리스틱에 맡길
이유가 없다.

**움직임은 셋으로 가른다.** 라이브러리는 안 쓴다 — `motion/react` 없이 CSS와
`IntersectionObserver` 20줄이면 된다.

| 무엇 | 어떻게 | 어디 |
| --- | --- | --- |
| 스크롤 리빌 | `Reveal`이 붙인 `data-reveal` → `data-shown` | 밴드 일곱, 기능 카드 여섯 |
| 순차 등장 | 위 리빌 안의 `data-stagger`, 순번은 `--i` | 목업 줄, 걸음, 문제 줄, 작동 방식 카드 |
| 진입·전이 | 순수 CSS 애니메이션 | 히어로(`data-enter`), 탭 패널(`data-panel`), FAQ 답 |

**감추는 일은 JS가 켜졌을 때만 한다.** 숨김 상태를 서버 HTML에 넣지 않고 `Reveal`이 붙은
뒤에 `data-reveal`을 단다 — `PageTransition`이 `opacity:0`인 HTML을 내보내는 바람에 JS를
끄면 화면이 통째로 비어 있던 적이 있다. 진입 애니메이션은 순수 CSS라 JS와 무관하고 끝나면
반드시 보이는 상태다.

**이미 보이는 것은 건드리지 않는다.** 붙는 시점에 뷰포트 안이면 그대로 둔다 — 안 그러면
보이던 것이 하이드레이션 순간 사라졌다 다시 떠서 깜빡인다. 한 번 뜨면 관찰을 끊는다.

`prefers-reduced-motion: reduce`면 `Reveal`이 아예 아무것도 안 붙이고, CSS도 두 번째
방어선으로 전부 끈다. 셋 다 실제로 확인했다 — JS 끔·축소 모션·보통에서 안 보이는 요소 0.

**웹폰트가 안 떠도 무너지지 않는다.** 폰트 요청을 전부 막고 확인했다 — 넘침 0, 잘림 0,
문서 높이 +29px(0.35%). 한글은 시스템 글꼴로 떨어지고 조판은 그대로다.

**그래서 JS 없이도 다 읽힌다.** 프로덕션 빌드에서 JS를 끄고 확인했다 — 밴드 아홉, 제목
서른셋, FAQ 첫 답까지 그대로 뜬다. `app/(main)/layout.tsx`에서 `PageTransition`을 뺀 것이
그 조건이다: 그것은 `motion`의 `initial={{opacity:0}}`이라 서버가 `opacity:0`인 HTML을
내보내고, 하이드레이션이 끝나야 보인다. 이 그룹에는 라우트가 하나뿐이라 `key={pathname}`이
바뀔 일도 없어서, 전환이 아니라 첫 페인트를 200ms 늦추는 일만 했다.

앵커 이동은 `scroll-behavior: smooth`를 `html`에 걸지 않고 **버튼의 `scrollIntoView`로** 한다 —
전역으로 걸면 라우트 이동의 「맨 위로 복귀」까지 애니메이션이 붙는다. 대상 섹션은
`scroll-mt-24`로 떠 있는 상단바 몫을 비운다. 앵커는 `#features`와 `#how-it-works` 둘이다.

**본문 건너뛰기 링크가 루트 레이아웃 첫 요소다.** 랜딩 안에 두면 상단바 링크를 다 지난 뒤에야
나와서 건너뛸 것이 없다. 평소에는 `sr-only`이고 `focus-visible`에서만 보인다.

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

워크스페이스에 들어간 뒤의 화면(사이드바·노트 상세·챗봇·알림·설정)은 마케팅 면과 다른 규칙을 따른다. **왜 다른가:** 마케팅은 흰 배경 위 잡지 조판이고, 제품은 회색 캔버스 위에서 실제로 뜨고 지는 레이어를 구분해야 한다. 마케팅 단일 티어 그림자(`0 4px 16px rgba(0,0,0,0.04)`)는 회색 캔버스에서 안 보인다. 정본 수치는 아래 표이며, 여기서는 코드 토큰과의 대응도 함께 못박는다.

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

**수치의 정본은 아래 표다.** 값이 나온 곳은 `heymoa/design/design.pen`이지만 **그 파일은 이 저장소 밖이고 git에도 없다**(Pencil 전용 포맷 · 10MB). fresh checkout에서는 열 수 없으므로 노드 ID는 출처 표시일 뿐이고, 구현이 대조할 대상은 이 표와 `e2e/smoke.spec.ts`의 「keeps the shell frame geometry from design.pen」이다 — 그 테스트가 아래 값을 실제로 잰다.

아래는 뷰포트 1440×900 기준 실측값이다.

| 화면 | 출처 노드 | 기하 |
| --- | --- | --- |
| 워크스페이스 | `IUax1` · `BviA2` | 사이드바 `232 · left 0` (투명) → 틈 `10` → 패널 `1188 × 880 · left 242 · top 10`. 거터 사방 10 |
| 노트 사이드 뷰 | `u3yYCX` | 시트 `860 × 884 · left 572 · top 8` (거터 8). 뒤에 scrim `--el-ink` 10% |
| 노트 전체 뷰 | `XtEMZ` + `L4PpR` | 본문 + 에이전트 레일 `440` (오른쪽 고정) |

패널 공통: `rounded-panel`(16) · `border 1px --el-hairline` · `bg --el-surface-card` · `shadow-e2`. 상단바는 `56`이고 배경 없이 아래 hairline만 갖는다.

**사이드바 테두리는 primitive에서 뺐다.** `group-data-[side=left]:border-r`이 특이도 (0,2,0)이라 호출부의 `border-r-0`(0,1,0)으로는 못 지운다 — 선이 필요한 쪽이 붙인다.

### 노트 목록에는 필터가 없다 (2026-08-07)

「전체 / 내가 시작」 칩 두 개가 있었는데 걷었다. **시작자로 걸러 보는 요구가 실제로 없다** — 회의는 프로젝트로 갈리고 시간순으로 읽히며, 누가 시작했는지는 각 행의 아바타가 이미 말한다. 「내가 시작」만 빼면 남는 것이 「전체」 하나인데, 고를 것이 하나면 고르는 것이 아니라 라벨이다.

**hairline은 헤더로 옮겼다.** 그 선은 필터 줄이 들고 있었지만 역할은 목록의 위 끝을 정하는 것이라 줄과 함께 없앨 수 없다. 헤더가 `border-b` + `pb-6`으로 받는다.

### 빈 워크스페이스의 두 빈 상태 (design.pen `kbUlG` / `O7yCDv` · 2026-08-06)

**빈 상태는 하나가 아니라 둘이다.** 예전에는 하나였고 문구가 "상단바의 **새 노트**로 첫 회의를 시작하면…"이었는데, 프로젝트가 없으면 그 버튼이 비활성이라 **가리키는 곳이 눌리지 않았다.** 무엇을 먼저 해야 하는지는 화면 어디에도 없었고, 유일한 입구인 사이드바 「프로젝트 만들기」는 왼쪽 아래에 있어 절차의 1단계로 읽히지 않았다.

| 상태 | 정본 | 제목 | 단계 카드 | CTA |
| --- | --- | --- | --- | --- |
| 프로젝트 0 | `kbUlG` | 회의를 담을 프로젝트부터 | 프로젝트 만들기 → 회의 만들기 → 기록하고 요약 확인 | 첫 프로젝트 만들기 |
| 프로젝트 있음 · 회의 0 | `O7yCDv` | 첫 회의를 기록해 보세요 | 회의 만들기 → 기록 시작 → 요약 확인 | 새 회의 만들기 |

**프로젝트 0에서는 제목·개수를 통째로 걷는다.** 「0개의 회의 기록」은 셀 것이 있다는 뜻인데 여기엔 아무것도 없다. 회의 0에서는 그 크롬을 남긴다 — 프로젝트를 골라 보는 것이 이미 의미 있는 상태다.

**CTA는 1단계 하나만 가리킨다.** 카드가 하는 일은 다음에 무엇이 오는지 보여 주는 것이고, 지금 누를 것은 아래 버튼 하나다. 둘을 나란히 두면 어느 쪽이 먼저인지 다시 헷갈린다.

#### 만들기 창은 셸이 소유한다

입구가 셋이다 — 사이드바 머리글 `+`, 상단바 「새 노트」, 빈 상태 CTA. 그중 「새 노트」는 **프로젝트가 없으면 프로젝트 창을 먼저 열고, 만든 뒤 회의 창으로 이어져야** 하므로 두 창이 한 자리에 있어야 이어 붙는다. 그래서 `workspace-app-shell`이 둘 다 들고 `openCreateProject` / `requestNewMeeting`을 컨텍스트로 내보낸다. 이름 변경은 사이드바가 계속 갖는다(대상이 있는 조작이라 입구가 하나뿐이다).

이어 붙이는 것은 **첫 프로젝트뿐이다.** 사이드바 `+`로 만드는 둘째·셋째 프로젝트에는 이어 붙일 이유가 없다 — 그때는 이미 회의를 만들어 본 사람이다.

정본 `kbUlG`의 1단계 라벨은 「회의 만들기」였고 2단계와 같은 말이었다(프레임 이름만 「프로젝트 만들기」였다). CTA도 이름은 「첫 프로젝트 만들기」인데 라벨은 「새 회의 만들기」였다. 둘 다 고쳤다.

### 스크롤은 어디가 갖나 (2026-08-07)

**제품 면의 스크롤 컨테이너는 `ScrollArea`다.** 네이티브 스크롤바는 레이아웃 폭을 먹어서, 내용이 도착해 스크롤이 생기는 순간 본문이 스크롤바만큼 좁아진다 — 로딩 직후 폭이 튀는 것이 그것이다. 게다가 제품 면은 `rounded-panel`(16) + `overflow-hidden` 패널 안이라 네이티브 바가 둥근 모서리에 붙어 잘린 채 그려진다.

`ScrollArea`(base-ui)의 스크롤바는 뷰포트 위에 얹히는 **오버레이라 폭을 먹지 않는다.** 시프트가 사라지고 「아래에 더 있다」는 신호는 남는다.

| 면 | 스크롤 주체 |
| --- | --- |
| 랜딩·약관 (마케팅) | **문서(`html`)** — 브라우저 기본에 맡긴다. 페이지 길이를 알려주는 유일한 신호이고, 여기엔 둥근 패널도 없다 |
| 노트 목록·전사·요약·정보·아카이브·챗 | `ScrollArea` |
| 팝오버·콤보박스 안의 짧은 목록 | `no-scrollbar` — 경계가 명확한 고정 폭이라 시프트가 애초에 없다 |

**스크롤바를 숨기는 것(`scrollbar-width: none`)은 긴 본문에서 하지 않는다.** 시프트는 사라지지만 「아래에 더 있다」는 신호, thumb 드래그, 현재 위치가 함께 사라진다. 긴 전사에서는 사실상 기능 삭제다.

#### 세로만 스크롤시킬 때

`ScrollArea`는 뷰포트에 **`overflow: scroll`을 인라인으로** 박는다(네이티브 바를 숨기고 스크롤은 살리는 방식). 그래서 가로를 막으려면 `viewportClassName="overflow-x-hidden!"`처럼 **`!`가 필요하다** — 저자 스타일시트의 `!important`만이 인라인 선언을 이긴다. 평범한 클래스는 조용히 무시되고, 세로 바만 그리는 면에서는 **손잡이 없는 가로 스크롤**이 남는다(노트 목록의 장식 블롭이 1026 폭에서 31px을 만들었다).

### 노트의 두 겹 크롬 — 상단바 + 노트 헤더 (design.pen `KktRX`+`MZRO0` / `Sghjz`+`c5cQ8n` · 2026-08-06)

노트 면의 크롬은 **두 줄이고 뜻이 다르다.** 한때 한 헤더에 다 몰아넣었더니 좁은 폭에서 그 줄이 감기며 세로로 자라 전사 높이를 0까지 밀어냈다(812×375 landscape에서 헤더 278/355 실측).

| 층 | 높이 | 무엇 | 언제 |
| --- | --- | --- | --- |
| 상단바 | `56` 고정 | `← 목록으로` · `확장`/`축소` · 구분선 · **상태 칩** · 제목 `13/600` … **탭** … `회의 종료` \| `⋯ 노트 메뉴` | 항상 |
| 제목 블록 | 내용 | 프로젝트 pill → 세리프 제목 `34/300` → 아바타 스택 + 메타 두 줄 | **정보 탭만** |

**상단바는 두 뷰 다 있다.** 전체 뷰는 워크스페이스 상단바를 통째로 덮고, 사이드 뷰 시트도 목록 위에 떠서 뒤의 바를 누를 수 없다 — 나갈 길이 여기밖에 없다. 그래서 **별도 「노트 닫기」 버튼은 없앴다**(같은 곳으로 가는 길이 둘이었다).

##### 크롬은 56이 기본이다 (2026-08-07)

**제목 블록은 노트의 크롬이 아니라 정보 탭의 머리글이다.** 전사·요약은 읽는 면인데 세리프 제목(41)과 메타 두 줄(36)이 얹혀 700 패널에서 크롬이 **233(33%)**까지 올라가 본문에 467만 남았다. 그 둘은 이미 다른 곳에 있다 — 제목은 상단바 빵조각에, 메타는 정보 탭의 「회의 정보」 표에.

| 탭 | 크롬 | 본문 |
| --- | --- | --- |
| 전사 · 요약 · 챗봇 | **56** (8%) | 644 |
| 정보 | 56 + 제목 블록 | — |

**탭이 상단바에 있어야 이게 성립한다.** 탭이 제목 블록 아래에 있으면 탭을 누를 때마다 줄이 141px씩 오르내려 **커서 밑에서 버튼이 도망간다.** 56 고정 바에 얹으면 제목 블록이 켜지든 꺼지든 탭은 제자리다(세 탭 모두 `y=11` 실측).

**상태 칩도 상단바다.** 전사를 읽는 동안 「지금 실시간인가」는 계속 필요한 정보인데, 제목 블록과 함께 사라지면 알 길이 없어진다.

**`회의 종료`와 `⋯ 노트 메뉴`는 오른쪽 한 자리를 나눠 쓴다.** 서로 배타적이다 — 삭제는 기록 중에 숨고(서버가 409로 막으니 눌러서 실패하게 두지 않는다), 회의 종료는 기록 중·중지됨에만 뜬다. 둘이 함께 서는 중지됨에서도 `88+32`라 860 사이드 시트에서 여유 24px이 남는다(실측). 제목이 `flex-1 min-w-0`으로 줄어들어 넘칠 수는 없다.

밑줄 탭은 상단바 안에서 `h-14`이고, 활성 밑줄이 바의 hairline 위에 앉아야 「이 바의 어느 칸인가」로 읽힌다 — primitive 기본값이 `after:bottom-[-5px]`라 그대로 두면 바 밖으로 떨어져 본문 위에 떠 있는 짧은 막대가 된다. 덮을 때는 **기본값과 같은 variant 셀렉터**를 쓴다(`group-data-horizontal/tabs:after:bottom-0`).

**hairline은 각 층이 하나씩 갖는다.** 상단바 아래에 하나, 제목 블록이 있으면 그 아래에 하나다.

**정본의 알림 벨은 뺐다**(`Tc3e6` 등 14개 화면 → `⋯ 더보기`로 교체). 노트 안에서 알림을 여는 흐름이 기획에 없고, 열면 이 면 위에 팝오버가 또 뜬다. 전체 뷰에는 워크스페이스 상단바가 없어 삭제 메뉴가 갈 곳이 그 자리뿐이다.

#### 상태 칩과 메타 두 줄

상태 칩은 `6px` 점(기록 중·종료됨) 또는 아이콘(시작 전 `calendar` · 중지됨 `pause`)에 `11/600` 라벨이다. **기록 중만 붉다** — 나머지는 사건이 아니라 상태다. 기록 중인데 시작자가 아니면 `[eye] 참관` 칩이 옆에 서서 **회의 제어가 없는 이유**를 말한다. 라벨은 `MEETING_STATUS_LABEL`을 그대로 쓴다(목록 행과 같은 이름) — 정본이 「예정」이라 적은 것은 목록이 「시작 전」으로 부르는 같은 상태다.

메타 두 줄의 아래 줄은 **상태마다 다른 질문에 답한다.** 시작 전에는 「언제 시작하나」, 기록 중에는 「누가 보나(참관이면 누가 기록 중인가)」, 끝난 뒤에는 「얼마나 기록됐나」다. 한 줄로 합치면 어느 상태에서도 절반이 군더더기다. 정본의 `워크스페이스 멤버 4명 공개`에서 수는 뺐다 — 그 수는 계약에 없고 위 줄이 이미 참석자 수를 말한다.

**초 단위로 바뀌는 값과 얼굴은 헤더에 없다.** 누적 기록 시간과 진행자는 정보 탭이, 진행 중 라이브 타이머는 레코더 독(`qYRCW`)이 갖는다. 헤더는 분 단위 요약만 그린다(「기록 42분 (종료 세션 누적)」).

#### 탭은 밑줄 탭이다 (`variant="line"` · 2026-08-06)

`h-9` 줄에 라벨(`12/500`)만 서고 활성 탭이 2px 밑줄을 갖는다. `gap-6`으로 **왼쪽에 `w-fit`으로 붙는다** — 탭이 셋~넷뿐인데 860 폭에 균등 분할하면 라벨 사이가 200px씩 벌어져 한 뭉치로 안 읽힌다(그래서 트리거에 `flex-none`이 필요하다. primitive 기본은 `flex-1`이다). 라벨은 `정보 / 전사 / 요약`(+ 사이드 뷰의 `챗봇`)이고 뷰·상태로 갈리지 않는다.

**세그먼트 알약이었던 적이 있다.** 노트 헤더가 이미 상태 칩·프로젝트 pill·아바타 스택으로 채워져 있어서, 그 아래 회색 알약이 또 얹히면 크롬이 두 겹으로 읽혔다. 밑줄은 자리를 차지하지 않으면서 어디인지만 말한다.

높이를 덮을 때는 **같은 variant 셀렉터로** 쓴다(`group-data-horizontal/tabs:h-9`) — primitive 기본값도 그 형태라(`:h-8`) 평범한 `h-9`는 tailwind-merge가 충돌로 보지 않아 조용히 무시된다.

#### 정보 탭 — 폼 + 사실 표 (design.pen `OctUK`·`is5eL` · 2026-08-06)

`Body`는 vertical · `gap-6`이고 **카드가 없다.** 예전에는 제목·참여자·사실이 각자 `rounded-block` 상자에 들어 있었는데, 카드 넷이 쌓이면 무엇이 편집이고 무엇이 읽기인지 테두리로 구분되지 않았다. 지금은 **편집만 컨트롤 테두리를 갖고** 읽기는 키/값 표로 눕는다.

| 층 | 무엇 |
| --- | --- |
| Form | 라벨(`12/600`) + 컨트롤(`h-9`) — 제목, 참석자. 그 아래 `변경 저장` |
| Facts | `회의 정보`(`13/600`) + 키 열 **124 고정**의 `12px` 표. `생성`·`최종 수정` 앞에 hairline 하나 |

키 열을 고정하는 이유는 값이 세로로 훑히기 때문이다 — 키 길이에 따라 값이 들쭉날쭉하면 무엇이 무엇인지 한 줄씩 다시 읽어야 한다.

##### 표는 헤더가 말하지 않은 것만 담는다 (2026-08-06)

Facts 행은 **진행자 · 누적 기록 시간 · 공유 범위 → hairline → 생성 · 최종 수정** 다섯이다. 한때 회의 상태·프로젝트·시작 시각·참석자도 여기 있었는데, 넷 다 바로 위 노트 헤더에 **글자까지 같은 모양으로** 이미 있었다(상태 칩, 프로젝트 pill, 메타 두 줄). 참석자는 더 심해서 헤더와 이 탭의 편집 필드와 표에 **세 번** 나왔다.

남기는 기준은 「한 줄 요약에 안 들어가는 사실」이다.

| 남은 행 | 왜 헤더로 안 되나 |
| --- | --- |
| 진행자 | 헤더는 **참관자에게만** 이름을 말한다(시작자에게는 자기 이름이라 군더더기) |
| 누적 기록 시간 | 헤더는 분 단위 요약이고, 기록 중에는 아예 안 적는다 |
| 공유 범위 | 헤더 메타 둘째 줄은 종료되면 누적 시간으로 바뀌어 이 값을 놓는다 |
| 생성 · 최종 수정 | 회의의 사실이 아니라 문서의 이력이라 헤더에 없다 |

그래서 **정보 탭은 프로젝트를 조회하지 않는다** — 헤더의 pill이 이미 그 이름을 말하고, 바꿀 길도 없다.

**정본과 일부러 다르게 간 것 넷.** 계약(`openapi3.yml`)이 정본을 다 못 받쳐서다.

| 정본 | 실제 | 왜 |
| --- | --- | --- |
| 맥락 Textarea | 없음 | 계약에 필드 자체가 없다 |
| 프로젝트 Select | 없음 (헤더 pill이 이름을 말한다) | `NoteRequest`는 `title`만 받는다 — 노트의 프로젝트를 바꾸는 길이 없다 |
| 「변경 사항은 자동 저장됩니다」 | `변경 저장` 버튼 | 저장이 끝나면 `updatedAt`이 바뀌어 폼이 재마운트되므로 자동 저장은 **타이핑 중 커서를 날린다.** 편집 대상이 제목 하나뿐이라 버튼으로 잃는 것도 없다 |
| 참석자는 시작 전에만 편집 | 항상 편집 | 계약이 `PUT /v1/notes/{noteId}/participants`를 "회의 상태와 무관하게 언제나 호출할 수 있다"고 못박았다. 늦게 합류한 사람을 뒤에 넣는 일은 실제로 생긴다 |

`누적 기록 시간`은 **초 단위 `role="timer"`가 사는 유일한 자리다** — 노트 헤더는 같은 값을 분 단위로 요약하고(「기록 42분」), 진행 중 라이브 타이머는 레코더 독이 갖는다. 정본은 여기도 분 단위였지만, 서버의 `recordedDurationMs` 누적이 정지·재개를 넘어 이어지는지는 초 단위로만 검증할 수 있다(`e2e/smoke.spec.ts`).

**정본에 남은 미해결 하나:** 시작 전 화면(`STdBl`)의 「일시」 필드는 계약에 대응하는 것이 없다(`scheduled*`·`startAt` 계열 전무). 그 화면을 구현할 때 서버부터 정해야 한다.

#### 근거 → 전사 점프 (2026-08-07)

요약 항목의 각주를 펼치면 인용 줄이 서고, 누르면 전사의 그 자리로 간다. 두 곳을 손질했다.

**인용 줄의 hover 배경은 여백을 갖는다.** 글자에 딱 붙어 있어서 짚을 자리로 안 보였다. 그냥 `px-2`를 주면 인용문만 오른쪽으로 밀려 위 항목과 줄이 안 맞으므로, 항목 줄과 같은 수법으로 **안쪽으로 넓히고 밖으로 같은 만큼 당긴다**(`-mx-2 px-2 py-1`).

**도착한 줄은 형광펜으로 짚는다 — 글자에만.** 회색 틴트(`--el-surface-strong`)는 hover·열림 표시가 이미 쓰는 값이라 2.4초만 사는 이 표시가 구별되지 않아 `--el-highlight`(형광 노랑)를 뒀다. 다만 **블록 배경을 통째로 칠하면 시각 열까지 물든 띠가 되어 너무 튄다** — 글자를 감싼 인라인 span에 얹는다(`box-decoration-clone`이 필요하다. 기본값 `slice`는 두 줄로 감기는 발화에서 배경을 잘라 줄 사이가 빈다).

**그 형광은 칠해져 있는 색이 아니라 그어지는 획이다 (2026-08-23).** 처음에는 line box를 통째로 덮는 노란 칸이 「띡」 하고 켜졌다 꺼졌다. 두 가지가 문제였다. 하나, **글자가 형광 안에 잠겨서** 짚은 것이 아니라 가린 것으로 보였다. 둘, 탭이 통째로 바뀐 직후에 정적인 칸이 서 있으면 **어느 줄인지 눈이 스스로 찾아야 한다** — 표시가 시선을 데려가지 못한다.

그래서 **글자 높이의 2/3만 밑에서부터 칠하고**(`0.66em`), 그 획을 왼쪽에서 오른쪽으로 **긋는다**. 색은 `background-color`가 아니라 `linear-gradient` 이미지다 — 색에는 폭이 없어서 획을 그을 수가 없다. 지울 때도 같은 방향으로 걷어 낸다(`background-position`을 오른쪽으로 밀면 왼쪽부터 비워진다). 통째로 꺼지면 「사라졌다」가 아니라 「끊겼다」로 읽힌다.

| 구간 | 시간 | 무엇 |
| --- | --- | --- |
| 긋기 | `stroke` | `background-size`가 0 → `span`. 각 줄은 제 폭에서 다 차고 멈춘다 |
| 머물기 | 1500ms | 다 그어진 채로 |
| 지우기 | `stroke` | `background-position`이 0 → `span`. 왼쪽부터 걷힌다 |

**고정된 것은 시간이 아니라 펜 속도다.** 어느 줄이든 같은 시간에 그으면 긴 발화에서는 펜이 몇 배 빨리 지나가고 짧은 발화에서는 기어간다 — 같은 표시가 줄마다 다른 물건으로 보인다. `span = min(글자수, 56)em`, `stroke = max(140ms, span × 10ms)`로 근사한다(폭을 재지 않는다. 한글은 글자당 폭이 거의 1em이다).

**그리고 그 속도는 한 발화 **안에서도** 같다.** 여기가 핵심이고, `%`가 아니라 **절대 길이**로 자라는 이유다. 폭의 백분율로 자라면 여러 줄로 감긴 발화에서 657px짜리 줄과 184px짜리 마지막 줄이 같은 시각에 끝난다 — 짧은 줄의 펜만 3.5배 느려진다. 모든 줄을 덮고도 남는 길이(`span`)까지 자라게 두면 각 줄은 **제 폭에서 먼저 다 차고 거기서 멈춘다**: 실측으로 184px 줄은 123ms에, 657px 줄은 438ms에 끝난다. 지울 때도 짧은 줄이 먼저 비워진다. 조각을 따로 나눌 필요가 없다 — `box-decoration-clone`이 줄마다 제 배경 상자를 준다. `linear`인 것도 같은 이유다.

상한 56em이 **읽기 폭 한 줄보다 넉넉해야 한다** — 못 미치면 긴 줄의 오른쪽 끝이 영영 안 칠해진다(전사 본문이 가장 넓은 자리가 아카이브의 약 730px ≈ 49em이다).

**긋기와 지우기는 두 개의 애니메이션이다.** 서로 다른 속성을 만지고(폭 / 시작점), `긋기 : 머물기` 비율이 발화마다 달라지는데 `@keyframes`의 `%`는 고정이라 하나로는 못 담는다. 지우개에 `animation-delay`를 주고 `fill-mode: forwards`로 둔다 — `forwards`는 **끝난 뒤에만** 적용되므로 지연이 흐르는 동안에는 지우개가 아직 아무것도 안 만지고 긋기의 결과가 그대로 보인다. 길이와 두 시간은 `use-transcript-focus.ts`가 심어 주고 **같은 값으로 focus를 비우는 타이머도 건다** — 두 시계가 갈라질 수 없다. `prefers-reduced-motion`에서는 애니메이션만 끄고 다 그어진 밑줄을 그대로 둔다.

**도착한 발화로 포커스도 옮긴다.** 형광은 칠일 뿐이라, 각주를 눌러 준 인용 버튼이 탭과 함께 사라지면 포커스는 `<body>`로 떨어졌다 — 보지 않는 사람에게 이 점프는 「화면만 바뀌고 아무 일도 안 일어난 것」이었다. 전사 행에 `tabIndex={-1}`을 늘 달아 두고(짚힐 때만 달면 형광이 꺼지며 읽던 사람의 포커스를 빼앗는다) `focus({ preventScroll: true })`로 잡는다. 테두리는 브라우저의 `:focus-visible` 판정에 맡기므로 마우스로 온 사람에게는 안 뜬다.

**근거를 펼치는 것도 움직임이다.** 그냥 마운트하면 인용 서너 줄이 한 프레임에 튀어나와 아래 항목을 통째로 밀어 내려서, 무엇이 새로 생겼고 읽던 줄이 어디로 갔는지 눈이 못 따라간다. `motion`으로 높이를 `0 → auto`로 200ms 자라게 한다(레코더 독과 같은 `spring · bounce 0` — 같은 면에서 열리고 닫히는 것들이 저마다 다른 속도로 움직이면 화면이 한 물건으로 안 읽힌다). **높이는 `<ul>`이 아니라 바깥 껍데기가 갖는다** — `<ul>`에 직접 걸면 `height: 0`에서도 `mt-3`과 왼쪽 세로선이 남아 접힌 자리에 선 토막이 선다.

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
