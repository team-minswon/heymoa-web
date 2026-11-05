# 사용 가이드 영어판 평가 (화면 이름 맞추기)

대상: `content/help/en/**`(31편), `messages/en/help.json`. 기준은 영어 대시보드 문구(`messages/en/*.json`, landing·legal·help·download 제외)와 용어집(docs `PRO-66-웹-국제화/spec/APP-1286/docs/glossary.md`, D16·D17)입니다.

한국어 가이드(`content/help/<그룹>/*.md`)는 다른 작업이 같은 시간에 고치고 있어 손대지 않았습니다. 예외로 `hub.uiNote` 키만 `messages/ko/help.json`에서도 지웠습니다(언어 파일의 키 목록이 같아야 해서).

## codex 평가

| 항목 | 1차 | 2차 |
|---|---|---|
| Slop (상투어·em dash·군말) | 5 | 5 |
| 용어 (UI 문구·용어집과 일치) | 4 | 4 |
| 명확성 (미국 영어, 쉬운 말, 할 일 중심) | 4 | 4 |
| 정확성 (화면 이름이 UI에 있음) | 3 | 4 |
| 평균 | 4.0 | 4.3 |

평가 원문은 `/tmp/claude-1000/eval-help-en-1.txt`, `/tmp/claude-1000/eval-help-en-2.txt`입니다(로컬, 커밋하지 않음).

## 반영한 지적

1차

- MCP 연결이 「읽기만 한다」고 단정함. 실제 동의 화면에 **Allow task changes**가 있음 → `agent-mcp.md`·`use-mcp.md`·`data-privacy.md`를 한국어판(이미 반영됨)과 같게 고쳤습니다. 기본은 읽기, 켜면 내 이름으로 할 일을 만들고 고침, 연결 뒤 바꿀 수 없음
- `find-decisions.md`의 **[Referenced meeting notes]**: 그런 이름의 화면이 없습니다. 답 아래 회의록 목록을 누르라고 고쳤습니다(`agent.md`도 같은 이유로 굵은 이름을 뺐습니다)
- `fix-speakers.md`의 **[Reset all assigned speakers]**(확인 창 제목) → 패널 버튼 **[Reset all speaker assignments]**
- `export.md`의 **[Content]** → **[What to send]**, **[Add all attendees]** → **[Add all attendees (N people)]**
- `help.json` 기록 묶음 요약이 「화자를 녹음 중에 정한다」로 읽힘 → 「name speakers after the meeting」
- `live-timeline.md`의 「remarks that only run the meeting」 → 「remarks that only keep the meeting moving」
- 개인 토큰을 「access password」로 풀어 계정 암호와 헷갈림 → 「a secret code you give the app so it can access HeyMoa」

2차

- `integrations.md`가 인용한 연결 실패 문구 → UI 문구 「Couldn't connect. Try again.」
- `agenda-map.md` 「**[Notes]** **[Connection map]** tabs」에 and를 넣음
- `agent-mcp.md` 「shows when the app used which tool」 → 「shows which tools the app used and when」
- `troubleshooting.md` 「once that device's recording has been closed out」 → 「Wait about 1 minute for the other device's recording session to close, then try again.」

## 남긴 지적과 이유

- **web app / the web / the browser가 섞임** (1·2차): 화면 이름이 아니라 본문 표현이고, 자리마다 「브라우저 권한」「브라우저 창」처럼 실제 브라우저를 가리키는 곳이 섞여 있어 기계적으로 바꾸면 틀립니다. 이번 범위(화면 이름)를 넘으므로 남깁니다
- **데스크톱 앱 창의 이름**(Get started with HeyMoa, Allow microphone, Check again ↻, Quit app, Stop recording and quit, Cancel quit, Discard audio and quit…, Open current meeting ↗, ⏸ Pause recording, Stop viewing, Your voice, Set up later and start): `apps/desktop`에 영어 문구가 없습니다(한국어 고정). 자연스러운 영어 번역으로 두었습니다
- **서버가 만드는 오류 문구 인용**(「Invites can't be sent right now…」, 「Too many requests right now…」, 「The review was changed.」 등): 웹 언어 파일에 없고 서버가 `Accept-Language`로 고르는 문구라 확인할 수 없어 그대로 뒀습니다
- **외부 이름**: macOS의 Privacy & Security, ChatGPT·Claude Code·Codex

## 바꾼 화면 이름

| 파일 | 이전 | 새 |
|---|---|---|
| terms-context·fix-terms·workspace-basics | Glossary | Custom vocabulary |
| terms-context·fix-terms | Already added / Over 40 characters / Over limit | duplicate / over 40 characters / over limit (미리보기 칩 문구 그대로 소문자) |
| terms-context | Find a word | Find a term |
| live-timeline | New | 뺌 (새 항목에는 표시가 없음) |
| live-timeline | Added detail | Expanded |
| live-timeline | Retracted | Reversed |
| live-timeline | (없음) | Awaiting an answer 추가 |
| live-timeline·desktop | References | Reference |
| meeting-end·summary-missing | Speaker separation / Analysis (단계) | Organize meeting / Check conflicts and assignees (실제 단계 4개: Organize meeting · Check conflicts and assignees · Review · Confirm) |
| meeting-end | Analyzing | 「Analyzing the meeting」 (상태 문구로 인용) |
| meeting-end·troubleshooting·summary-missing | Reanalyze | Regenerate |
| meeting-end | Go set participants | Go to participants |
| review | Undo exclude | Include |
| review·confirm-summary | Add decision / Add task | Add to Decisions / Add to Tasks |
| review | Name speaker | Name speakers |
| review | Will apply | To apply |
| review | N suggestions to review (버튼처럼 씀) | 하단 바 문구로 인용 |
| export | Not sent | Failed |
| export | Resend to N not sent | Resend to N failed recipients |
| export | Content | What to send |
| export | Add all attendees | Add all attendees (N people) |
| speakers·fix-speakers | Apply to all of this speaker's lines | Apply to all lines from this speaker |
| speakers·fix-speakers | Reset all assigned speakers | Reset all speaker assignments |
| workspace-basics | Show older notes | Show earlier notes |
| workspace-basics | Meeting info | Meeting details |
| agent-mcp | Usage history | Activity |
| agent-mcp | Create personal token | Create personal access token |
| agent-mcp·use-mcp | Allow MCP connection | Allow MCP connections |
| agent-mcp | Open connections | Active connections |
| agent-mcp·use-mcp | (없음) | Allow task changes 추가 |
| members·invite-team | Pending invites | Pending invitations |
| agent | Open it | Open |
| agent | Delete conversation | ⋯ 메뉴의 Delete |
| agent | (이름 바꿀 수 없음) | ⋯ 메뉴의 Rename (실제로 있음) |
| agent | History / + | Chat history / New chat |
| agent | Create a task | Create tasks |
| agent | Reject | Decline |
| agent | Awaiting approval / Rejected / Void / Needs check | Needs approval / Declined / Invalid / Needs checking |
| agent·find-decisions | Referenced meeting notes | 굵은 이름을 빼고 본문으로 |

본문 용어도 같이 맞췄습니다: speaker separation → speaker identification, glossary → custom vocabulary, conversation(채팅) → chat, invite(명사) → invitation, action item → task(회의록 양식 예시), personal token → personal access token. 인용한 화면 문구도 언어 파일과 같게 고쳤습니다(초대 오류 2개, 일시정지 안내 「Recording paused. Wrap up now?」, 화자 식별 중 안내, 회의 맥락 녹음 중 안내, 일시정지 구간 표시, 응답 시간 초과).

## 같이 바꾼 것

- `hub.uiNote`(「앱은 아직 한국어」) 키를 ko·en 언어 파일에서 지우고, 허브 페이지(`app/[lang]/help/page.tsx`)의 그 문단을 뺐습니다. 시험은 안내가 없음을 확인하도록 바꿨습니다
- 검색 시험(`help-pages-en.test.tsx`, `e2e/help-en.spec.ts`)의 검색어 glossary → vocabulary. 검색 상자 예시도 「recording, vocabulary」
- `content/help/README.md` 영어판 안내에서 「앱 화면은 아직 한국어」 문장을 지우고, 영어 대시보드 문구와 똑같이 쓴다는 기준으로 바꿨습니다
- 고친 영어 파일은 `modified`를 2026-11-05로 올렸습니다. 섹션 id·slug·front matter 구조는 그대로입니다

## 한국어판과 달라진 것

`agent.md`의 이름 바꾸기·삭제 위치(⋯ 메뉴)와 요약 단계 이름(회의 정리·충돌·담당 확인)은 실제 화면에 맞춘 것이라 한국어판 문장과 다릅니다. 한국어판도 같은 기준으로 고칠지는 한국어 작업 쪽에서 판단합니다.

## 코드 리뷰 (codex)

| 회차 | 지적 | 처리 |
|---|---|---|
| 1 | P2 glossary가 영어 가이드에서 모두 빠져 옛 낱말로 검색하면 용어 페이지가 안 나옴 | `terms-context.md`에 「Custom vocabulary is a glossary for transcription.」 한 문장을 두고, `help-pages-en.test.tsx`에 glossary 검색 시험을 다시 넣었습니다 |

앵커·slug 변경은 없습니다.

## 커밋 기록

영어판 작업 전체가 커밋 `04f0eb37` 하나에 있습니다. 처음에는 결정 기록 커밋이 stage된 파일을 함께 담아 둘로 갈라졌는데, push 전에 결정 기록(`bf304bbb`)과 이 작업을 다시 나눴습니다.
