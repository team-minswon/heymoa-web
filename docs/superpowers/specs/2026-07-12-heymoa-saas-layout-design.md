# HeyMoa SaaS Layout & Navigation Design

## 1. Goal

Transition HeyMoa's web app architecture into a clear, separated SaaS model to accommodate both non-users (promotional landing) and logged-in users (productivity dashboard) without compromising either experience.

## 2. Structural Approaches

### 2.1 Complete Separation of Landing and Dashboard

- **Landing Page (`/`)**: A promotional page featuring a top Navbar, hero sections, and clear call-to-actions. Designed to attract non-users without the distraction of an app sidebar.
- **SaaS Dashboard (`/w/[workspaceId]/*`)**: Once logged in, users are redirected to their default workspace context. The layout here drops the landing page Navbar in favor of a robust left Sidebar (for workspace switching, user settings, navigation) and a main content area (for meetings and notes).

### 2.2 Authentication Flow

- **Modal-based Auth**: On the landing page, clicking "Login" or "Get Started" will open a modal popup rather than navigating to a separate `/auth/login` page. This ensures a seamless entry point.
- **Redirection**: If an authenticated user visits the root `/`, they are instantly redirected to `/w/[workspaceId]` based on their recent or default workspace.

## 3. UI/UX Design System Upgrades

- Use EleventLabs editorial style (defined in HeyMoa guidelines).
- Sidebar: Collapse/Expand capabilities, workspace switcher dropdown at the top, user profile and settings at the bottom.
- Document Viewer Area: Expand to use maximum horizontal space for comfortable reading and editing.
- Responsive Design: Sidebar collapses into a hamburger menu on mobile devices.

## 4. Components Affected

- `app/(main)/page.tsx` & `app/layout.tsx`: Adjust Navbar visibility (using `NavbarGate` or similar mechanism) so the Navbar only appears on the landing page and not inside `/w/`.
- `app/w/[workspaceId]/layout.tsx` (NEW): Will introduce the Sidebar shell that wraps all workspace routes.
- Authentication components: Need to migrate from page-based to a unified Modal component triggered from the Navbar.

## 5. Security & Redirects

- Middleware / Proxy: Ensure `/` redirects authenticated users to their workspace.
- Unauthenticated users trying to access `/w/*` will be redirected to the root `/` with the auth modal automatically triggered.
