# project-tracker-web

**Status:** Thin client on real `project_tracker` APIs (dashboard / projects / tasks)  
**Kind:** Next.js  
**Backend:** `project_tracker` (+ hub `zatgo_core` ping)  
**Package:** `@zatgo/project-tracker-web`  
**Stack:** [FRONTEND_STACK](../../Docs/Foundation/FRONTEND_STACK.md)

## Auth

Sign in with ERPNext / Frappe **site URL + email/password**. Login runs on the Next.js server (`/api/erpnext/*`) via `@zatgo/erpnext` and stores an encrypted httpOnly cookie.

Set `ERPNEXT_SESSION_SECRET` in production (required). For local dev, copy `.env.example` to `.env.local` and either set a secret or `ALLOW_INSECURE_DEV_SECRETS=1`.

## Features (Phase 6)

| Page | API |
|------|-----|
| Dashboard | hub `ping` + `projects.dashboard_summary` |
| Projects | `projects.list_projects` |
| Tasks | `projects.list_tasks` + `projects.update_task_status` |

Kanban / Gantt / approvals remain on Frappe Desk.

## Run

```bash
pnpm install
pnpm --filter @zatgo/project-tracker-web dev
# → http://localhost:3004
```

Optional:

```bash
NEXT_PUBLIC_FRAPPE_BASE_URL=http://127.0.0.1:8082 \
ALLOW_INSECURE_DEV_SECRETS=1 \
pnpm --filter @zatgo/project-tracker-web dev
```
