# Editorial Workspace and Audio Meter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 워크스페이스 노트 목록을 편집형 레이아웃으로 정돈하고 실제 음성에 반응하는 마이크 파형을 만든다.

**Architecture:** 오디오 계층에서 RMS를 지각 가능한 레벨로 변환하고 provider가 최근 레벨 이력을 소유한다. 표현 컴포넌트는 공통 레벨 이력을 읽어 목록, 전역 표시기, 전사 화면에서 일관된 파형을 그린다.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Web Audio API, Vitest, Testing Library

## Global Constraints

- OpenAPI, AsyncAPI, Orval 생성물은 변경하지 않는다.
- 새 런타임 의존성을 추가하지 않는다.
- UI 문구는 한국어만 사용한다.
- `role="meter"`와 `aria-valuenow`를 유지한다.

---

### Task 1: Perceptual microphone level

**Files:**
- Modify: `lib/transcription/audio.ts`
- Test: `lib/transcription/audio.test.ts`

**Interfaces:**
- Produces: `normalizeMicrophoneLevel(rms: number): number`

- [ ] 무음, noise floor, 음성 입력, clipping 범위를 표현하는 실패 테스트를 작성한다.
- [ ] `pnpm vitest run lib/transcription/audio.test.ts`로 기존 선형 RMS 동작 때문에 실패함을 확인한다.
- [ ] noise floor 제거와 지수 곡선을 적용해 `0..1` 값을 반환한다.
- [ ] 오디오 캡처가 보정된 값을 `onLevel`에 전달하도록 연결한다.
- [ ] 동일 테스트가 통과하는지 확인한다.

### Task 2: Level history and waveform state

**Files:**
- Modify: `components/transcription/recording-provider.tsx`
- Modify: `components/transcription/recording-provider.test.tsx`

**Interfaces:**
- Produces: `RecordingContextValue.levelHistory: number[]`

- [ ] 입력 레벨이 들어오면 고정 길이 이력이 갱신되고 pause에서 0으로 초기화되는 실패 테스트를 작성한다.
- [ ] focused test가 `levelHistory` 부재로 실패함을 확인한다.
- [ ] attack/release smoothing과 고정 길이 이력을 provider에 구현한다.
- [ ] focused test를 통과시킨다.

### Task 3: Editorial workspace list

**Files:**
- Modify: `components/workspace/workspace-page.tsx`
- Modify: `components/workspace/workspace-note-list.tsx`
- Modify: `components/workspace/note-list-row.tsx`
- Modify: `components/workspace/workspace-note-list.test.tsx`

**Interfaces:**
- Consumes: 기존 `NoteSummaryResponse`와 workspace/note URL 규칙

- [ ] 카드 wrapper 제거와 날짜별 평면 목록 구조를 검증하는 실패 테스트를 작성한다.
- [ ] focused test가 기존 card class 때문에 실패함을 확인한다.
- [ ] 제목 기준선, 날짜 구분선, 조밀한 행, 반응형 메타데이터를 구현한다.
- [ ] focused test를 통과시킨다.

### Task 4: Shared live waveform presentation

**Files:**
- Modify: `components/workspace/note-list-row.tsx`
- Modify: `components/workspace/workspace-toolbar.tsx`
- Modify: `components/transcription/global-recording-indicator.tsx`
- Modify: `components/notes/transcript-view.tsx`
- Test: `components/notes/transcript-view.test.tsx`
- Test: `components/transcription/global-recording-indicator.test.tsx`

**Interfaces:**
- Consumes: `RecordingContextValue.levelHistory`

- [ ] 서로 다른 이력 값이 서로 다른 막대 높이로 렌더링되는 실패 테스트를 작성한다.
- [ ] focused tests가 정적 weight 배열 때문에 실패함을 확인한다.
- [ ] 모든 live meter가 같은 최근 이력을 사용하도록 교체한다.
- [ ] pause에서는 평평한 파형을 표시한다.
- [ ] focused tests를 통과시킨다.

### Task 5: Verification

**Files:**
- No production file changes

- [ ] `pnpm test:run`을 실행한다.
- [ ] `pnpm lint`를 실행한다.
- [ ] `pnpm build`를 실행한다.
- [ ] 데스크톱과 모바일에서 워크스페이스, side note, 실제 마이크 권한 흐름을 브라우저로 확인한다.
- [ ] 변경 파일만 커밋한다.

