# heymoa-web Rebuild Roadmap

This document defines how `heymoa-web` will be rebuilt from a fresh React/Next baseline while preserving the existing `main` history.

The goal is not to reset git history. The goal is to create `dev` from the current `main`, overlay a clean baseline on `dev`, and rebuild the current product behavior through issue, branch, and pull request records.

## Principles

- Preserve the current `main` history.
- Create `dev` from `main` before rebuilding product code.
- Overlay the React/Next baseline as a new commit on `dev`; do not reset to an old commit.
- Create work branches from `dev` and merge back into `dev` with squash merge.
- Keep issue, branch, PR, and final squash commit names aligned.
- Intermediate rebuild steps do not need to be fully production-ready.
- The final `dev -> main` release must behave similarly to the current `main`, except for intentional cleanup or improvements recorded in issues and PRs.
- Improve weak agent-generated code while rebuilding, as long as the final behavior remains compatible with the product goal.

## Branch and PR Rules

```text
main: stable branch
dev: rebuild integration branch
type/issue/slug: short-lived branch from dev
```

Examples:

```text
chore/1/add-github-workflow-templates
docs/2/document-web-rebuild-roadmap
chore/3/overlay-react-baseline
feat/12/rebuild-api-key-management
```

PR titles should include the linked issue number:

```text
chore: add GitHub workflow templates (#1)
docs: document web rebuild roadmap (#2)
feat: rebuild API key management (#12)
```

PR bodies should include:

```md
Closes #12
```

## High-Level Flow

```mermaid
flowchart TD
    Main["main\ncurrent working web"] --> Templates["PR to main\nGitHub issue / PR templates"]
    Templates --> Dev["create dev from main"]
    Dev --> Roadmap["PR to dev\nrebuild roadmap"]
    Roadmap --> Baseline["PR to dev\nReact / Next baseline overlay"]
    Baseline --> Rebuild["feature PRs to dev\nrebuild product behavior"]
    Rebuild --> Parity["final parity verification\ncompare with current main"]
    Parity --> Release["release PR\ndev -> main"]
```

## Rebuild Dependency Map

```mermaid
flowchart TD
    T["1. Workflow templates"] --> R["2. Rebuild roadmap"]
    R --> B["3. React baseline overlay"]
    B --> F["4. App foundation\nlayout, providers, styles"]
    F --> A["5. Auth shell\nOAuth, cookies, refresh"]
    A --> P["6. Public pages and navigation\nhome, terms, privacy, nav/footer"]
    A --> O["7. Onboarding flow\nroute gate, wizard"]
    O --> D["8. Dashboard shell\norganization routing, sidebar"]
    D --> C["9. Generated API client and fetcher\nOpenAPI, app response"]
    C --> M["10. MSW mock backend\nstate, handlers, local UX"]
    D --> G["11. Organization dashboard pages\nsettings, members, usage placeholders"]
    C --> K["12. API key management\nlist, create, rename, revoke"]
    M --> K
    G --> V["13. Final parity verification"]
    K --> V
```

## Planned Issues

The exact issue numbers will be assigned by GitHub. After each issue is created, use the assigned number in the branch name.

| Order | Type  | Title                                | Target | Notes                                                               |
| ----- | ----- | ------------------------------------ | ------ | ------------------------------------------------------------------- |
| 1     | chore | Add GitHub workflow templates        | `main` | One allowed exception before `dev`, so templates work in GitHub UI. |
| 2     | docs  | Document web rebuild roadmap         | `dev`  | This document becomes the source of truth for rebuild order.        |
| 3     | chore | Overlay React baseline               | `dev`  | Replace current product code with a clean baseline as a new commit. |
| 4     | chore | Rebuild app foundation               | `dev`  | Layout, global styles, providers, metadata, basic route structure.  |
| 5     | feat  | Rebuild auth shell                   | `dev`  | Auth provider, login button, OAuth paths, cookie refresh behavior.  |
| 6     | feat  | Rebuild public pages and navigation  | `dev`  | Home/static pages, navbar/footer gates, brand assets.               |
| 7     | feat  | Rebuild onboarding flow              | `dev`  | Onboarding route gate, wizard, submit behavior.                     |
| 8     | feat  | Rebuild dashboard shell              | `dev`  | Dashboard routing, organization selector, sidebar shell.            |
| 9     | feat  | Add generated API client and fetcher | `dev`  | OpenAPI generation, fetcher, app response handling.                 |
| 10    | feat  | Add MSW mock backend                 | `dev`  | Mock state and handlers for local rebuild verification.             |
| 11    | feat  | Rebuild organization dashboard pages | `dev`  | Organization settings, member, usage, webhook placeholder pages.    |
| 12    | feat  | Rebuild API key management           | `dev`  | List, create, secret display, rename, revoke, filters.              |
| 13    | test  | Verify final web parity              | `dev`  | Confirm rebuilt `dev` behaves similarly to current `main`.          |

## Current Main Capability Inventory

The rebuild should preserve or intentionally improve these current capabilities:

- Next.js app shell with global providers and error/not-found handling.
- Public/static routes and shared navigation/footer behavior.
- Google OAuth entry points and cookie-based auth state.
- Auth refresh and unauthenticated state handling.
- Onboarding route and profile wizard.
- Dashboard entry route that redirects to the first organization.
- Organization-scoped dashboard layout and sidebar navigation.
- Organization settings and placeholder dashboard sections.
- Generated OpenAPI client and shared fetch response handling.
- MSW-backed local mock API behavior.
- API key dashboard with list, create, rename, revoke, and status filtering.

## Final Parity Checklist

Before opening the final `dev -> main` release PR:

- Run `pnpm lint`.
- Run `pnpm build`.
- Verify public pages render.
- Verify auth UI states and OAuth links.
- Verify onboarding redirect and submission behavior.
- Verify dashboard organization routing.
- Verify organization settings update behavior.
- Verify API key list, create, rename, revoke, and filtering behavior.
- Verify mock mode still supports local flows when enabled.
- Record any intentional behavior changes in the release PR.

## Release Shape

```mermaid
sequenceDiagram
    participant Main as main
    participant Dev as dev
    participant Feature as feature branch
    participant PR as pull request

    Main->>Dev: create dev from current main
    Dev->>Feature: branch for one issue
    Feature->>PR: open PR to dev
    PR->>Dev: squash merge after review
    Dev->>Dev: repeat rebuild steps
    Dev->>Main: final release PR after parity verification
```
