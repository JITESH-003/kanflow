# kanflow

A team ticketing tool where **each team defines its own workflow** — its own ordered stages, field-locking rules, and notification rules — and **everything updates live** across users with no refresh.

> Configurable workflow engine + real-time Kanban. Built end-to-end on free-tier infra.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript, Tailwind + shadcn/ui |
| Board UX | dnd-kit · TanStack Query · Zustand |
| Backend | NestJS + TypeScript |
| Real-time | Socket.IO |
| Database | PostgreSQL + Prisma (Neon) |
| Storage | Cloudflare R2 (S3 API) |
| Auth | JWT (access + refresh) |
| Hosting | Vercel · Render · Neon · Cloudflare R2 |

## Monorepo layout

```
kanflow/
  apps/
    api/   NestJS backend (REST + Socket.IO gateway + workflow engine)
    web/   Next.js frontend (Kanban board, ticket modal, notification sidebar)
  packages/
    (shared types — added later)
```

## Local development

```bash
npm install                # from repo root — installs all workspaces
npm run dev:api            # NestJS on :3001
npm run dev:web            # Next.js on :3000
```

## Status

🚧 In active development — see the phased build plan.
