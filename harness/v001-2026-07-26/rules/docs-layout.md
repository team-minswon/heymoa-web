# 문서를 쓰는 자리

| 어디 | 무엇 | 수명 |
|---|---|---|
| `docs/superpowers/specs/` | brainstorming 산출물 (설계) | 작업과 함께 굳습니다 |
| `docs/superpowers/plans/` | writing-plans 산출물 (계획) | 작업과 함께 굳습니다 |
| `docs/frontend-architecture.md` | 지금 프론트가 어떻게 생겼나 | 코드가 바뀌면 같이 고칩니다 |
| `DESIGN.md` · `docs/design/` | 디자인 판단의 원본 | 코드가 바뀌면 같이 고칩니다 |
| `docs/codex-review-app-N.md` | 그 이슈의 codex 리뷰 기록 | 안 고칩니다 |

**`specs/`·`plans/`의 파일명만** `YYYY-MM-DD-영문-slug.md`입니다. 이미 50개 넘게 그 형태입니다.
리뷰 기록은 여기 안 걸립니다 — `docs/codex-review-app-N.md` 그대로 씁니다. 날짜를 붙이면
`code-review` skill이 찾는 `docs/codex-review-app-*.md` 패턴에서 빠집니다.

superpowers 두 skill의 기본 경로가 그대로 이 레포의 경로입니다. heymoa-ai의
`docs/issues/APP-N-slug/`로 통일하지 않았습니다 — 옮기면 마이그레이션만 생깁니다.

## 어디에 안 넣나

- 계약 원본을 `docs/`에 복사하지 않습니다. 원본은 docs repo(`../docs`)의 `origin/main`이고
  진입점은 그 레포의 `INDEX.md`입니다.
- 토큰 값·파일 목록처럼 코드가 원본인 것을 문서에 옮기지 않습니다. 기준만 쓰고 원본을 링크합니다.
- 하네스 안(`harness/`)에 설계 문서를 쓰지 않습니다. 하네스는 지시이고 설계는 `docs/`입니다.
