# 공용 셸·사이드바 (`shell`)

맡은 파일:

- `components/workspace/workspace-sidebar.tsx`, `workspace-app-shell.tsx`, `workspace-toolbar.tsx`, `workspace-route-layout.tsx`, `workspace-route-skeleton.tsx`, `desktop-app-promo.tsx`, `desktop-compare-dialog.tsx`
- `components/heymoa/desktop-download-link.tsx` (데스크톱 앱 안내와 비교 창에서만 쓰여 같이 옮겼습니다)
- `components/layout/focus-chrome.tsx`, `Navbar.tsx`, `Footer.tsx` (`components/layout/` 나머지는 한글 UI 문구가 없거나 이미 `common`을 씁니다)
- 언어 파일: `messages/<ko|en>/shell.json`, `messages/<ko|en>/common.json`의 `actions`(취소·저장·삭제·다시 시도)

`Navbar`·`Footer`는 마케팅 면에 그려지지 않습니다. 마케팅 경로는 모두 `isLandingChromeRoute`(또는 가이드)라 `NavbarGate`·`FooterGate`가 랜딩 상단 바·푸터를 세우고, 마케팅 404도 이 둘을 그리지 않는 것을 렌더로 확인했습니다. 그래서 문구를 `shell`에 두고 마케팅 루트의 `clientNamespaces`는 바꾸지 않았습니다. 실제로 그려지는 곳은 제품 루트의 `/mock-oauth`, `/help-samples`, 로그아웃 상태의 `/inquiries/*`입니다.

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 5 |
| 적합도 | 4 | 4 |
| 일관성 | 4 | 4 |
| **평균** | **4.0** | **4.3** |

## 반영한 지적

- `appShell.integrationConnected`·`integrationFailed`: 「연동을 연결」 반복을 없앴습니다(ko·en)
- `toolbar.pauseTooltip`(en): em dash 없이 두 문장으로
- `desktopPromo.body`(en): 「what you hear in YouTube」를 고치고, 1440에서 물음표 아이콘이 다음 줄로 밀려 더 줄였습니다
- `desktopPromo.compare`·`compareTooltip`, `desktopCompare.steps.sound/sameData.description`(en): 「web app / desktop app」으로 통일
- `desktopCompare.steps.background.title`·`sameData.title`(en): 한국어 뜻(창을 닫아도, 쓰던 기록 그대로)에 맞춤
- `desktopCompare.stepGroup`: 「1 / 3」 대신 무엇의 순서인지 읽히게(ko·en)
- `desktopCompare.table.supported/unsupported`(en): Can record / Can't record
- `navbar.loadFailedDescription`: 재시도 버튼이 있는 오류라 「다시 시도해 주세요」(ko·en)
- `sidebar.deleteDialog.description`(ko): 피동 「삭제되고」를 능동으로(2차 지적)

## 남긴 지적과 이유

- `sidebar.feedback` 「Help & feedback」: 공개된 가이드 영어판 표기입니다(D5)
- `navbar.sections.evidence` 「Sources」, `footer.download` 「Desktop app」: 랜딩 영어판과 같은 링크 이름입니다
- `sidebar.renameDialog.description`(en 단순화 제안): 한국어와 같은 뜻을 유지했습니다
- `toolbar.pauseTooltip`(ko)의 em dash: 녹음 독·전역 녹음 표시기(`recording` 모듈)가 같은 문장을 씁니다. 한쪽만 바꾸면 갈라지므로 `recording` 모듈에서 같이 고칩니다
- `desktopPromo.compare`(ko 「웹과 앱의 차이 보기」): 툴팁이 이미 「보기」를 붙여 읽히고 시험이 이름으로 찾아 그대로 두었습니다
- `desktopCompare.table.supported/unsupported`(ko), `steps.sameData.title`(ko): 문구 기준에 걸리지 않아 그대로 둡니다(D7)

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `sidebar.toast.renamed` | 프로젝트 이름이 변경되었습니다. | 프로젝트 이름을 바꿨습니다. |
| `sidebar.toast.renameFailed` | 프로젝트 이름 변경에 실패했습니다. | 프로젝트 이름을 바꾸지 못했습니다. |
| `sidebar.toast.deleted` | 프로젝트가 삭제되었습니다. | 프로젝트를 삭제했습니다. |
| `sidebar.deleteDialog.description` | {name} 프로젝트와 이 프로젝트에서 나눈 에이전트 대화가 삭제되고 되돌릴 수 없습니다. 노트가 있는 프로젝트는 삭제할 수 없습니다. | {name} 프로젝트와 이 프로젝트에서 나눈 에이전트 대화를 삭제합니다. 되돌릴 수 없습니다. 노트가 있는 프로젝트는 삭제할 수 없습니다. |
| `appShell.integrationConnected` | {provider} 연동을 연결했습니다. | {provider} 연결을 마쳤습니다. |
| `appShell.integrationFailed` | 연동 연결에 실패했습니다. 잠시 후 다시 시도해 주세요. | 연동하지 못했습니다. 잠시 후 다시 시도해 주세요. |
| `desktopPromo.body` | 회의실 대화도, 화상회의·강의·유튜브에서 듣는 말도 기록하세요. | 회의실 대화도, 화상회의와 강의, 유튜브에서 듣는 말도 기록하세요. |
| `desktopCompare.stepGroup` (aria) | {current} / 3 | {total}단계 중 {current}단계 |
| `navbar.loadFailedDescription` | 잠시 후 다시 확인해 주세요. | 잠시 후 다시 시도해 주세요. |
| `footer.disclaimer` | AI 회의 에이전트는 사용자의 업무 효율을 높이는 보조 수단입니다. | AI 회의 에이전트는 업무를 돕는 보조 수단입니다. (랜딩 푸터와 같은 문장) |

## 렌더 확인

영어 계정, 1440·1024.

| 경로 | 무엇을 열었나 | 넘침 | 비고 |
|---|---|---|---|
| `/w/01K0000000000` | 사이드바, 상단바, 데스크톱 앱 안내 | 없음 | 「Skip to content」(화면 밖 링크)와 「내 에이전트」(chat 모듈) 측정값만 잡힘 |
| 같은 화면 | 워크스페이스 전환 메뉴, 계정 메뉴, 프로젝트 메뉴, 이름 변경 창, 삭제 확인 창 | 없음 | |
| 같은 화면 | 데스크톱 비교 창 1·2·3단계 | 없음 | 1단계 설명이 두 줄이 되어 고정 높이 머리를 넘어 한 줄로 줄임. 「Can record」는 sr-only라 측정값만 잡힘 |
| `/mock-oauth` | Navbar, Footer | 없음 | |
| `/invite` | FocusTopBar, FocusFooter | 없음 | |

남은 한글 중 다른 모듈 것:

- `workspace`: 목록 머리 「모든 노트」·「N개의 회의 기록 · 발화와 결정이 시간순으로 보관됩니다.」, 노트 행 상태·「기록 N분」·「참여 N명」·「노트 열기/메뉴」 aria, 날짜 머리(`2026년 11월 4일 (수)`), 사이드바 문의 배지 aria 「새 답변 1개」(`feedback-dialog.tsx`의 `UnseenCount` 기본값), 초대 카드(`invite-landing`)
- `chat`: 「내 에이전트」 FAB·첫 안내 말풍선
- 공용 primitive: `components/ui/dialog.tsx`의 sr-only 「닫기」
- 목 데이터: 워크스페이스 이름·프로젝트 이름·노트 제목·사람 이름(「새 워크스페이스」도 목 워크스페이스 이름), `/mock-oauth` 본문

## 코드 리뷰

| 회차 | 지적 | 처리 |
|---|---|---|
| 1 | P3: `WorkspaceRouteSkeleton`의 서버·클라이언트 언어 일치 시험이 없음 | 남김. 서버와 클라이언트가 같은 `productLocale()`을 쓰고(`i18n/request.ts`), 렌더 확인에서 영어로 나옴 |
| 1 | P3: 영어 ICU 복수형(`unreadNotifications`)을 실행하는 시험이 없음 | 남김. 렌더 확인에서 확인 |
| 1 | Navbar·Footer가 제품 루트에서만 그려진다는 판단 | 맞다고 확인 |

P1·P2는 없었습니다.
