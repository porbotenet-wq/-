# STSphera

Telegram Bot + Mini App for construction project management.

## Latest update

- Telegram bot now supports contextual Mini App deep-links (REQ-BOT-006):
  - `/app` command opens Mini App
  - Quick actions from callbacks (`fact_select`, `defect_facade`, `view_tasks`, `view_modules`) open Mini App with context (`task_id`, `facade_id`, `date`, `mode`)
- Mini App parses launch context from `startapp` and URL query params, then navigates to the target screen (`/tasks`, `/plan-fact`, `/modules`, `/project`)

## Documentation

Full product architecture and requirements specification:

**[docs/architecture/00-index.md](docs/architecture/00-index.md)** — Master index with all 12 sections.

### Sections

| # | Section | File |
|---|---------|------|
| 0 | Index & Self-Check | [00-index.md](docs/architecture/00-index.md) |
| 1 | Product Architecture | [01-product-architecture.md](docs/architecture/01-product-architecture.md) |
| 2 | Workflow Logic | [02-workflow-logic.md](docs/architecture/02-workflow-logic.md) |
| 3 | Task Model | [03-task-model.md](docs/architecture/03-task-model.md) |
| 4 | RBAC | [04-rbac.md](docs/architecture/04-rbac.md) |
| 5 | Functional Requirements | [05-functional-requirements.md](docs/architecture/05-functional-requirements.md) |
| 6 | Data Entities | [06-data-entities.md](docs/architecture/06-data-entities.md) |
| 7 | Notifications & Escalations | [07-notifications-escalations.md](docs/architecture/07-notifications-escalations.md) |
| 8 | Technical Stack | [08-technical-stack.md](docs/architecture/08-technical-stack.md) |
| 9 | Assumptions & Gaps | [09-assumptions-gaps.md](docs/architecture/09-assumptions-gaps.md) |
| 10 | MVP Scope | [10-mvp-scope-cutline.md](docs/architecture/10-mvp-scope-cutline.md) |
| 11 | Backlog | [11-backlog.md](docs/architecture/11-backlog.md) |
| 12 | Role Operating Model | [12-role-operating-model.md](docs/architecture/12-role-operating-model.md) |

### Key Numbers

- **20** Functional Requirements (REQ-*)
- **24** Database Entities
- **18** Notification Scenarios
- **10** RBAC Roles
- **12** Epics, **79** Stories
- **~344** Story Points estimated
- **Tech Stack**: Node.js + NestJS + TypeScript + React + PostgreSQL + Redis + grammY
