import type { Metadata } from "next";
import Link from "next/link";

import { SurfaceOutput } from "@/components/arc/surface-output";
import { getSurface, isSurfaceId, SURFACES } from "@/lib/arc/surfaces";

const SURFACE_EMOJI: Record<string, string> = {
  clock: "🕐",
  topbar: "📺",
  "leg-left": "◀",
  "leg-right": "▶",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surface: string }>;
}): Promise<Metadata> {
  const { surface } = await params;
  if (!isSurfaceId(surface)) return { title: "Unknown Surface · Output" };
  const label = getSurface(surface)?.label ?? surface;
  const emoji = SURFACE_EMOJI[surface] ?? "🔲";
  const emojiSvg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`;
  return {
    title: `${label} · Output`,
    icons: { icon: emojiSvg },
  };
}

export default async function OutputPage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  const { surface } = await params;

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      {isSurfaceId(surface) ? (
        <SurfaceOutput surfaceId={surface} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-500">
          <p className="text-lg font-medium">Unknown surface "{surface}".</p>
          <p className="text-sm">
            Try:{" "}
            {SURFACES.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/output/${s.id}`} className="underline">
                  {s.id}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}
    </main>
  );
}
