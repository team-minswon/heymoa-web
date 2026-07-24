# APP-153 디자인 토큰·공용 셸 정합 설계

**목표:** v5 SPEC의 고도·형태·타이포 스케일을 코드 토큰으로 못박고, 마케팅/제품 규칙을 `DESIGN.md`·`AGENTS.md`에 분리 기술한다. 화면별 재구성(154~157)이 이 토큰을 소비한다.

**입력:** `docs/design/v5-spec-notes.md`(FORM·ELEVATION SPEC), 현재 `app/globals.css`, 공용 셸 컴포넌트, `DESIGN.md`, `AGENTS.md`.

**범위 밖:** 화면 단위 재구성(사이드바 120→56·상단바 1단·노트 상세·챗봇·알림 — 각자 이슈), 계약·데이터 변경, `.pen`.

## 자문자답으로 잡은 것

### `--el-*`에는 색만 있고 고도·형태·타이포는 화면마다 손으로 쓴다

실측: `globals.css`는 색 토큰(`--el-canvas`·`--el-ink`…)과 shadcn radius 배율(`--radius-sm..4xl`)만 가진다. **고도·형태 스케일·타이포 스케일에 대응하는 토큰이 없다.** 그 결과 공용 셸 크롬조차 그림자를 제각각 손으로 쓴다:

| 위치 | 현재 값 | 정체 |
|---|---|---|
| 레코더 툴바 pill (`workspace-toolbar`) | `shadow-[0_8px_32px_rgba(28,25,23,0.12)]` | 부양 독 → e2 |
| 사이드바 드롭다운·메뉴 오버레이 (`workspace-sidebar`) | `shadow-[0_4px_16px_rgba(0,0,0,0.08)]` ×3 | 오버레이 → e3 |
| 노트 목록 빈 상태 카드 | `shadow-[0_4px_20px_rgba(0,0,0,0.03)]` | (154에서 정리) |

**AGENTS.md는 이 갈라짐을 부추긴다.** Styling 절이 "Cards: `rounded-2xl … shadow-[0_4px_16px_rgba(0,0,0,0.04)]`"를 단일 규칙으로 적어, 제품 카드에도 마케팅 단일 티어 그림자를 쓰라고 지시한다. 이 값은 ELEVATION SPEC이 "흰 마케팅 페이지용이라 제품에서 안 보인다"고 명시적으로 배제한 값이다.

### 마케팅/제품 경계는 코드에 이미 있는데 문서에 없다

`components/heymoa/primitives.tsx`의 `Panel`(단일 티어 그림자·`rounded-2xl`)은 **`legal-document.tsx`·`landing-client.tsx`만** 소비한다 — 마케팅 면 전용이고 그 값이 맞다. 제품 화면은 자기 카드를 따로 그린다. **경계가 코드엔 있는데 `DESIGN.md`엔 없어서**(마케팅만 기술) 제품 화면마다 "이 그림자 맞나"를 다시 결정했다. 이 이슈가 그 경계를 문서화한다.

### 공용 셸 컨테이너는 이미 각지고 그림자 없다 — 유지만

`workspace-app-shell`의 App Panel·`Sidebar`·`SidebarInset`은 r0 · hairline · 그림자 없음으로 이미 ELEVATION SPEC "셸" 행을 지킨다. 재구성 불필요. 셸 안의 **부양/오버레이 레이어**(레코더 독·사이드바 드롭다운)만 새 고도 토큰으로 정합한다.

## 토큰 (Tailwind v4 `@theme inline`, `globals.css`)

FORM·ELEVATION SPEC 수치를 그대로 옮긴다. 이름은 크기가 아니라 역할로 짓는다 — 크기가 바뀌어도 이름이 산다.

**고도** (`--shadow-*` → `shadow-e2`/`shadow-e3`)
```
--shadow-e2: 0 2px 4px #0c0a090f, 0 10px 28px #0c0a091c;   /* 부양: 챗봇 카드·플로팅 독·FAB */
--shadow-e3: 0 4px 8px #0c0a0914, 0 20px 56px #0c0a092b;   /* 오버레이: 시트·다이얼로그·드롭다운 */
```
셸(App Panel·사이드바·메인)은 그림자 없음 — 토큰을 두지 않는다(hairline로만 구분).

**형태 스케일** (`--radius-*` → `rounded-panel`/`block`/`control`/`chip`)
```
--radius-panel: 16px;  --radius-block: 10px;  --radius-control: 8px;  --radius-chip: 6px;
```
circle·pill은 `rounded-full`. 셸은 각짐(radius 0). 기존 `--radius-sm..4xl`(shadcn 배율)은 건드리지 않는다 — 이름이 달라 충돌 없다.

**타이포 스케일** (`--text-*` → `text-screen-title` 등)
```
--text-screen-title: 34px;  --text-note-title: 26px;  --text-section: 20px;
--text-panel-title: 18px;   --text-read: 15px;   /* 전사 본문 + 목록 행 제목 */
```
14 이하(탭·채팅·메타·힌트)는 Tailwind 기본 `text-sm`/`text-xs`를 그대로 쓴다 — 토큰화하지 않는다.

## 이 이슈가 소비하는 곳 (비구조적 정합)

토큰 채택을 이 이슈에서 실증한다. 재구성이 아니라 값 치환만:

- `workspace-toolbar` 레코더 pill 그림자 → `shadow-e2` (MOTION SPEC 계승 표면, 구조 불변)
- `workspace-sidebar` 드롭다운/메뉴 오버레이 그림자 3곳 → `shadow-e3`

노트 목록 행·빈 상태 카드의 `rounded-2xl`·min-h-64 구조는 FORM SPEC drift #1이지만 **재구성이라 APP-154**가 받는다. 여기서 만지지 않는다.

## 문서

- **`DESIGN.md`** — 제품편 신설. 마케팅(랜딩·약관): 오프화이트 캔버스·pill CTA·단일 티어 그림자·그라데이션 오브. 제품(워크스페이스 이후): 각진 셸·2연타 고도(e2/e3)·형태 스케일 5단계·대문자 키커 금지·세리프 300 제목만 정체성으로 유지. 두 면이 공유하는 것: `--el-*` 색, Inter/EB Garamond.
- **`AGENTS.md` Styling 절** — 단일 "Cards" 규칙을 마케팅/제품으로 분리. 제품 고도는 `shadow-e2`/`e3`, 형태는 `rounded-panel/block/control/chip`, 셸은 각짐·무그림자. 단일 티어 `0_4px_16px`는 마케팅 전용으로 명시.

## 완료 조건

- [ ] `globals.css`에 고도·형태·타이포 토큰이 존재하고 Tailwind 유틸(`shadow-e2`/`rounded-panel`/`text-screen-title`)로 생성된다
- [ ] 공용 셸 크롬(레코더 pill·사이드바 오버레이)이 raw `shadow-[...]` 대신 토큰을 쓴다
- [ ] `DESIGN.md`에 제품편이 있고 마케팅 규칙과 구분된다
- [ ] `AGENTS.md` Styling 절이 실제 코드와 일치한다
- [ ] 토큰 존재 회귀 테스트(vitest) 통과
- [ ] 게이트 통과 · `codex exec review --base dev` P1 없음 · Playwright로 기존 화면 안 깨짐 확인

## 링크

- 이슈: https://linear.app/minswon/issue/APP-153
- 근거: `docs/design/v5-spec-notes.md`(FORM·ELEVATION SPEC), `docs/design-decisions.md`
- 후속: APP-154(사이드바)·155(노트 상세)·156(챗봇)·157(알림)이 이 토큰을 소비
