# Workspace and Note App Shell Design

## 목적

회의록 MVP의 기능 검증용 화면을 실제 제품 탐색에 적합한 앱 셸로 재구성한다. Tiro의 화면을 복제하지 않고 다음 정보 구조만 참고한다.

- 워크스페이스와 폴더를 지속적으로 탐색할 수 있는 좌측 영역
- 날짜별로 빠르게 훑을 수 있는 조밀한 노트 목록
- 목록의 맥락을 유지한 채 열리는 노트 상세 패널
- 페이지를 이동해도 유지되는 전역 녹음 제어

이번 작업은 현재 OpenAPI와 AsyncAPI가 지원하는 Workspace, Folder, Note, TranscriptionSession, TranscriptSegment 기능만 사용한다.

## 범위

### 포함

- `/w/**` 전용 앱 셸
- 워크스페이스 및 폴더 탐색
- 날짜별 노트 목록과 노트 생성
- 데스크톱 노트 Sheet, 모바일 노트 Drawer, 전체 화면 노트
- 노트 정보 수정과 폴더 연결
- 세션 및 전사 Segment 표시와 Segment 삭제
- 전역 녹음 시작, 일시정지, 재개, 종료
- 로딩, 빈 상태, 오류, 삭제 확인 UI
- 현재 URL 계약 유지

### 제외

- 워크스페이스 설정 및 멤버 관리
- participant 모델
- private/team 가시성
- 검색 API가 필요한 실제 검색
- 캘린더, 데스크톱 앱, 사용량 및 요금제
- 템플릿, AI 문서, 요약, 챗봇
- TranscriptSegment 수정
- 원본 오디오 저장 및 재생

## URL과 표시 상태

노트의 정식 주소는 그대로 유지한다.

```text
/w/{workspaceId}/notes/{noteId}?view=side|full&tab=transcript|details
```

- `view=side`: 데스크톱에서는 오른쪽 Sheet, 모바일에서는 아래쪽 Drawer
- `view=full`: 독립적인 전체 화면 노트
- `tab=transcript`: 원본 전사
- `tab=details`: 노트 정보
- 잘못되거나 누락된 query는 `view=full&tab=transcript`로 정규화한다.
- 패널을 닫으면 `/w/{workspaceId}`로 이동한다.
- 표시 방식과 탭 전환은 query만 변경하며 현재 노트 ID는 유지한다.

## 레이아웃 구조

### 마케팅과 앱 레이아웃 분리

- `/`, `/privacy`, `/terms` 등 공개 화면은 기존 Navbar와 Footer를 유지한다.
- `/w/**`에서는 기존 Navbar와 Footer를 렌더링하지 않는다.
- 앱의 로고와 사용자 메뉴는 Workspace Sidebar로 이동한다.

### 데스크톱 앱 셸

```text
┌──────────────────┬─────────────────────────────────────────┐
│ Workspace Sidebar│ App Toolbar                             │
│                  ├─────────────────────────────────────────┤
│ 모든 노트         │ Date-grouped Note List                  │
│ 폴더              │                                         │
│                  │                              Note Sheet │
└──────────────────┴─────────────────────────────────────────┘
```

Sidebar는 고정되고 본문만 스크롤한다. App Toolbar에는 현재 위치, 녹음 언어, 새 노트 및 녹음 제어를 배치한다. 녹음 중에는 Toolbar가 세션 상태와 경과 시간을 표시한다.

### 모바일 앱 셸

- 상단 App Bar에 Sidebar 열기, 현재 위치, 녹음 상태를 표시한다.
- Workspace Sidebar는 왼쪽 Sheet로 연다.
- 노트 `view=side`는 아래쪽 Drawer로 연다.
- 노트 전체 화면에서는 콘텐츠와 녹음 제어를 우선하고 부가 메타데이터를 축약한다.

## Workspace Sidebar

Sidebar는 다음 순서로 구성한다.

1. HeyMoa 로고 및 워크스페이스 이름
2. 사용자 Avatar와 사용자 DropdownMenu
3. 모든 노트
4. 폴더 목록
5. 새 폴더 액션

폴더 행은 클릭 시 필터를 적용한다. 행의 DropdownMenu에서 이름 변경과 삭제를 제공한다. 이름 변경은 Dialog 안의 Input을 사용하고 삭제는 AlertDialog로 확인한다. 현재 선택한 폴더를 삭제하면 모든 노트로 돌아간다.

사용자 메뉴는 현재 API 범위에서 사용자 이름과 이메일 표시, 기존 설정 페이지 이동만 제공한다. 사용량, 요금제, 템플릿 관리는 표시하지 않는다.

## App Toolbar와 전역 녹음

Toolbar는 현재 선택한 폴더 이름 또는 `모든 노트`를 제목으로 사용한다.

- 기본 상태: 언어 Select, 새 노트 Button, 기록 시작 Button
- 연결 중: Skeleton 또는 진행 상태와 중복 실행 방지
- 녹음 중: Recording Badge, 경과 시간, 일시정지, 종료
- 일시정지: Paused Badge, 경과 시간, 재개, 종료

녹음을 시작할 노트가 없으면 새 Note를 생성한 뒤 해당 Note의 TranscriptionSession을 시작하고 노트 패널을 연다. 이미 열린 노트가 있으면 해당 노트에서 시작한다. 동시에 하나의 세션만 연결하는 기존 제약을 유지한다.

노트 밖으로 이동하거나 Sheet/Drawer를 닫아도 RecordingProvider와 WebSocket은 유지된다. 전역 제어는 Toolbar와 모바일 App Bar에서 같은 provider 상태를 사용한다.

## 노트 목록

카드 그리드 대신 날짜별 조밀한 행 목록을 사용한다.

각 행은 다음 정보를 표시한다.

- 녹음 여부 아이콘과 길이
- 제목
- 연결된 Folder Badge
- 생성 또는 최근 기록 시각
- 생성자 이름
- 행 DropdownMenu

노트 행 전체를 클릭하면 `view=side&tab=transcript`로 연다. DropdownMenu는 `전체 화면으로 열기`와 `삭제`만 제공한다. 삭제는 AlertDialog로 확인한다.

노트가 없으면 현재 필터에 맞는 Empty State와 새 노트 Button을 표시한다. 로딩 중에는 실제 행 형태와 유사한 Skeleton을 사용한다. API 오류는 Alert와 재시도 Button으로 표시한다.

## 노트 Sheet, Drawer, 전체 화면

### 표시 원칙

- 데스크톱 Sheet는 목록을 완전히 가리지 않는 범위에서 약 720~800px 너비를 사용한다.
- 배경 목록은 읽을 수 있도록 유지하며 별도 복제 렌더링이나 강한 blur를 사용하지 않는다.
- Sheet와 Drawer는 접근성 있는 닫기, ESC, focus trap을 제공한다.
- 전체 화면은 같은 `NotePanel` 콘텐츠를 다른 컨테이너에 배치한다.

### Note Header

- 노트 제목
- 연결 Folder Badge
- Sheet에서 전체 화면 전환
- DropdownMenu의 노트 삭제
- 닫기

노트 ID는 기본 화면에 노출하지 않고 필요한 경우 Tooltip 또는 개발 정보로만 남긴다.

### Note Tabs

shadcn Tabs를 사용한다.

- `원본`: Session 목록, 확정 Segment, 실시간 Partial, 녹음 제어
- `노트 정보`: 제목, 맥락, Folder 연결

현재 API에 문서 생성 기능이 없으므로 `문서` 탭은 만들지 않는다.

### Transcript 화면

- Session 목록은 왼쪽의 작은 목록 또는 Select로 제공한다.
- 확정 Segment는 sequence와 타임코드 순서를 유지한다.
- Partial은 점선 테두리와 `전사 중` 상태로 Final과 구분한다.
- Segment는 수정할 수 없고 DropdownMenu 또는 아이콘 버튼으로 삭제만 가능하다.
- Segment 삭제 후 나머지 sequence는 다시 번호 매기지 않는다.

### Note Details 화면

- 제목 Input
- 맥락 Textarea
- 폴더를 선택하는 Popover 또는 Command 기반 다중 선택
- 명시적인 저장 Button

저장 성공은 짧은 상태 피드백으로 표시하고, 실패하면 입력값을 보존한 Alert를 표시한다.

## shadcn 구성요소

다음 구성요소를 우선 사용한다.

- 구조: Sidebar, Sheet, Drawer, ScrollArea, Separator
- 탐색: Tabs, DropdownMenu, Tooltip
- 입력: Input, Textarea, Select, Popover, Command
- 상태: Badge, Skeleton, Alert
- 행동: Button, Dialog, AlertDialog
- 사용자: Avatar

기존 raw `input`, `select`, `window.prompt`, `window.confirm`은 해당 shadcn 구성요소로 교체한다. 제품 토큰을 사용하고 임의의 색상·radius·shadow 반복을 줄인다.

## 컴포넌트 경계

```text
WorkspaceAppShell
├── WorkspaceSidebar
├── WorkspaceToolbar
├── WorkspaceNoteList
│   └── NoteListRow
└── NoteRouteSurface
    ├── NoteSheet (desktop side)
    ├── NoteDrawer (mobile side)
    └── NoteFullPage
        └── NotePanel
            ├── NoteHeader
            ├── TranscriptView
            └── NoteDetails
```

`NotePanel`은 표시 컨테이너를 알지 못한다. URL query 해석과 Sheet/Drawer/full 선택은 `NoteRouteSurface`가 담당한다. Workspace 데이터 동작과 녹음 상태는 기존 Orval hooks 및 RecordingProvider를 그대로 사용한다.

## 데이터 흐름

1. WorkspaceAppShell이 Workspace, Folder, Note 목록을 Orval query로 가져온다.
2. 폴더 선택은 목록 query의 `folderId`만 변경한다.
3. 노트 클릭은 정식 Note URL로 client navigation한다.
4. NoteRouteSurface가 viewport와 `view` query에 따라 Sheet, Drawer, full 컨테이너를 선택한다.
5. NotePanel은 Note, Session, Segment query와 RecordingProvider를 사용한다.
6. mutation 성공 후 관련 query key만 invalidate한다.
7. 녹음 이벤트는 RecordingProvider reducer에 반영하고 Final Segment는 REST 목록과 segmentId로 중복 제거한다.

## 오류 및 경계 조건

- 존재하지 않는 Workspace 또는 Note는 앱 셸 안의 Not Found 상태로 표시한다.
- API 오류는 기능 영역별 Alert와 재시도를 제공한다.
- mutation 진행 중에는 해당 버튼만 비활성화한다.
- 녹음 연결 오류는 전역 Toolbar와 NotePanel 양쪽에서 같은 오류 상태를 보여준다.
- 다른 노트에서 이미 녹음 중이면 새 녹음을 시작하지 않고 현재 녹음 노트로 이동하는 액션을 제공한다.
- 패널 닫기는 진행 중 녹음을 종료하지 않는다.

## 테스트 및 검증

### 단위 및 컴포넌트 테스트

- query 정규화와 side/full 전환
- 데스크톱 Sheet 및 모바일 Drawer 선택
- 폴더 필터와 날짜 그룹
- 삭제 AlertDialog 확인/취소
- 노트 저장 실패 시 입력 보존
- 녹음 중 다른 노트 시작 방지
- Partial과 Final 중복 제거

### 브라우저 검증

1. `/w/{workspaceId}`에서 기존 Navbar와 Footer가 보이지 않는다.
2. Sidebar에서 폴더 필터, 생성, 이름 변경, 삭제가 동작한다.
3. 노트 행이 Sheet로 열리고 URL query가 일치한다.
4. 모바일 viewport에서는 같은 URL이 Drawer로 열린다.
5. 전체 화면 전환 후 탭 상태가 유지된다.
6. 녹음 시작 후 Sheet를 닫아도 Toolbar 상태와 WebSocket이 유지된다.
7. 일시정지, 재개, 종료와 Partial/Final 전사가 표시된다.
8. Segment 삭제 후 남은 타임코드와 sequence가 유지된다.
9. 브라우저 콘솔 오류와 접근성 이름 누락이 없다.

## 성공 기준

- `/w/**`가 마케팅 Navbar에 의존하지 않는 독립적인 앱 셸로 동작한다.
- 현재 API만으로 Workspace 탐색부터 전사 확인까지 자연스러운 한 화면 흐름을 제공한다.
- 데스크톱에서는 목록과 노트를 함께 볼 수 있고 모바일에서는 제한된 화면을 효율적으로 사용한다.
- 녹음 세션은 라우트와 노트 패널 수명주기에서 분리되어 전역적으로 유지된다.
- 기능 동작에 raw form control이나 브라우저 기본 prompt/confirm을 사용하지 않는다.
