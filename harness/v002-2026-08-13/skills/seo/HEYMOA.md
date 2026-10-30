# HeyMoa SEO 운영

대상은 이 저장소의 마케팅 페이지와 공개 사용 가이드입니다. 저장소 루트에서 실행합니다.
공개 주소는 `lib/site.ts`, 언어·경로·canonical은 `lib/i18n/`, 사이트맵은 `app/sitemap.ts`가 정본입니다.

이슈 담당자는 김민수(`alstn113`)로 지정합니다. 완료한 변경은 이슈별 로컬 squash merge로 통합합니다.
원격 push·운영 배포는 별도 사용자 요청 때만 수행합니다.

## 점검 순서

1. Linear에서 `heymoa-web`의 기존 SEO 이슈·본문·댓글을 확인합니다. 완료된 수정은 운영에서 재현되는 경우에만 후속 이슈를 만듭니다.
2. Search Console의 `heymoa.app` 속성에서 검색 실적·검색어·랜딩 페이지·사이트맵·색인 제외 주소를 확인합니다. 날짜 범위를 기록하고, 이미지·폰트·인증 경로의 제외를 공개 본문 색인 실패로 세지 않습니다.
3. GA4에서 `heymoa` 속성의 자연검색 세션과 착지 페이지를 확인합니다. PostHog는 연결된 프로젝트 이름을 먼저 확인한 뒤 동일 기간의 자연검색 유입과 행동을 확인합니다. 서로 다른 도구의 세션·방문자·클릭을 합치지 않습니다.
4. `seo-technical`, `seo-hreflang`, `seo-sitemap`, `seo-content`, `seo-schema` 중 필요한 지침을 읽고 실제 HTML·상태 코드·본문과 대조합니다. 확인하지 못한 지표는 미측정으로 남깁니다.
5. 재현되는 결함이나 구체적인 콘텐츠 개선을 한 이슈·한 되돌림 단위로 만들고 처리합니다. 완료 댓글에 근거, 검증, 운영 반영 여부를 남깁니다.

## 실행 환경

사용자 결정(2026-10-30): **현재 브라우저와 MCP만 사용합니다.** Python 전용 환경·Chromium·새 추적기·외부 유료 서비스를 자동 설치하거나 연결하지 않습니다.
스킬 지침과 참조 문서는 바로 사용할 수 있습니다. 포함된 Python 도구는 별도 런타임 설치 전에는 실행할 수 없습니다.
Search Console·GA4는 로그인된 브라우저, PostHog는 연결된 MCP를 우선 사용합니다. 계정의 비밀값이나 로그인 쿠키를 파일·이슈에 복사하지 않습니다.

진단만 하는 명령:

```bash
rtk proxy .claude/skills/seo/scripts/claude-seo doctor --json
```

## 변경 기준

- canonical·hreflang·robots·구조화 데이터는 기존 공용 생성 경로에서 고칩니다. 제품 면의 noindex와 비운영 배포의 색인 제외를 지킵니다.
- 내용이 바뀔 때 가이드 frontmatter의 `modified` 또는 `lib/page-dates.ts`를 갱신합니다. 배포 시각으로 날짜를 만들지 않습니다.
- 사용자에게 도움이 되는 실제 기능·단계·한계를 씁니다. 확인하지 않은 검색량·성능·순위·후기를 만들지 않습니다. FAQ·HowTo 마크업을 추가해 Google 검색 기능이 보장된다고 주장하지 않습니다.
- 한국어 가이드를 고치면 영어판도 함께 고칩니다. 기존 slug·anchor·짧은 navTitle을 유지합니다.
- upstream의 홍보 문구를 답변·콘텐츠·이슈에 추가하지 않습니다.
- 검증과 머지는 이 저장소의 `CLAUDE.md`와 `merging` 스킬을 따릅니다.

## 설치 출처

- 원본: https://github.com/AgriciDaniel/claude-seo
- 버전: 2.5.0
- 고정 커밋: `6be93f45064ffbadced572b5d5c95f55fd263af0`
- MIT 라이선스: 이 폴더의 `LICENSE`
- 설치: skill-installer로 upstream `skills/*`를 프로젝트 공유 스킬 폴더에 설치했습니다. upstream 수동 설치 구조대로 공용 scripts·data·schema와 agents·런타임 메타데이터를 이 `seo/` 폴더에 둡니다. 유료 확장은 설치하지 않았습니다.
- 로컬 변경: 전역·플러그인 경로를 저장소 상대 경로로 바꿨습니다. 허브의 Community Footer 홍보 지시를 제거하고 이 운영 기준을 추가했습니다.
- `.agents/skills`와 `.claude/skills`는 같은 하네스를 가리킵니다. Claude의 `.claude/agents`도 이 폴더의 `agents/`를 가리킵니다.

업데이트는 위 커밋과 upstream 변경을 비교한 뒤 명시적으로 수행합니다. 자동 업데이트하지 않습니다.
