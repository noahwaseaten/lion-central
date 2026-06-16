<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: [Lion Central] Arc Control & Live Feed App

## Stack
- Next.js (App Router), TypeScript, pnpm
- shadcn/ui (preset: b2BVA82Vs, base theme, pointer variant)
- Tailwind CSS

## Commands
- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm lint` — lint check
- `pnpm typecheck` — type check (run after changes)

## Architecture
- App is private/internal — no public auth, no monetization
- Live feed page is LOCAL ONLY — reads a .txt file from local filesystem, never deployed to production
- Arc control page will communicate with the digital arc hardware/software

## Design Rules (NON-NEGOTIABLE)
- Consistent across all pages: same spacing scale, same color tokens, same component variants
- Simple and intuitive — no decorative complexity
- Every interactive element must have: hover, focus, loading, and error states
- Offline-first awareness: show offline banner when no connection, disable network actions gracefully
- Use shadcn components as the base — do not reinvent UI primitives

## Live Feed Feature
- Reads last 3 lines of a local .txt file
- Format per line: `BIB FIRSTNAME LASTNAME TIME`
- This is a triathlon — splits are Swim, Bike, Run (affects time label shown)
- Animate entries: new arrivals slide/fade in, smooth transitions
- Visual variation based on split type or other factors

## Code Style
- TypeScript strict mode
- Named exports, no default exports except pages
- Components in /components, pages in /app
- No inline styles — Tailwind only
- Keep components small and focused

## Git
- Branch per feature: `feature/live-feed`, `feature/arc-control`
- Commit per logical change, not per file