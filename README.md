This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Arc displays (local only)

These pages drive the physical arc screens and read from the local filesystem — **never deploy them**. See `SPEC.md` for the full design.

- **`/live`** — the 1280×256 top bar: sponsor strip + shoulders with the live athlete feed in the bottom-center. Press **S** for the setup drawer (file picker, split thresholds, polling).
- **`/clock`** — the 320×64 race-clock counter. Press **C** for controls (start / pause / reset / set).

### Configuration

Copy `.env.example` to `.env.local` and set `FEED_DIR` to the absolute path of the folder containing the timing backend's `.txt` feed file(s):

```bash
FEED_DIR=C:\path\to\timing\feeds
```

Each feed line is `BIB FIRSTNAME LASTNAME TIME`, where `TIME` is cumulative race time (`H:MM:SS` or `MM:SS`). The split (Swim/Bike/Run) is inferred from that time against the thresholds set in the setup drawer.

### Commands

```bash
pnpm dev        # dev server
pnpm build      # production build
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest (pure-logic unit tests)
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
