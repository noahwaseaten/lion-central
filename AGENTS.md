<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lion Heart Ultra - Internal Staff App System Specs & Core Guidelines

## Tech Stack & Styling Constraints
* **Framework:** Next.js (App Router), TypeScript, Tailwind CSS.
* **UI Foundation:** Strictly use components initialized by the Shadcn UI preset via the pointer: `pnpm dlx shadcn@latest init --preset b2BVA82Vs --base base --template next --pointer`.
* **Tokens:** Rely entirely on semantic design tokens (`bg-primary`, `bg-card`, `text-muted-foreground`). Never introduce arbitrary hex values or custom colors.
* **Ergonomics:** Minimum touch target sizes for all interactive elements must be $44 \times 44\text{px}$ to facilitate fast, high-stress mobile usage outdoors.

## Core Feature: Award Ceremony Management
* **Purpose:** Replace the complex Google Sheet system for the Lion Heart Ultra award ceremony with a secure, private, error-proof verification pipeline.
* **Audience:** Core organizers, team members, and volunteers on-site.
* **Hierarchy:** Event Segment (Ultra/Relay) -> Division/Gender -> Age Bracket -> Podium Rank (1st, 2nd, 3rd).
* **Workflow Lifecycle:** Every category card must progress cleanly through explicit states: `[ UNCONFIRMED ]` -> `[ CONFIRMED ]` -> `[ AWARDED ]`. Include logistics checklist states (`[ Medal Given ]`, `[ Gift Bag Handed Out ]`).

## Network Resilience (Offline-First)
* **Status Monitoring:** The app must track `navigator.onLine`. If connection drops, display a high-contrast sticky indicator warning staff that changes are caching locally.
* **Optimistic Updates:** UI must assume server success instantly.
* **Local Persistence:** Form inputs and status updates must immediately write to browser storage (`IndexedDB` or `LocalStorage`) so data is never lost if a cell signal drops mid-action.