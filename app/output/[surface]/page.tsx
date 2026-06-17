"use client";

import Link from "next/link";
import { use } from "react";

import { SurfaceOutput } from "@/components/arc/surface-output";
import { isSurfaceId, SURFACES } from "@/lib/arc/surfaces";

/**
 * `/output/<surface>` — the clean, full-screen render of one arc surface, sized
 * to fit whatever screen it's shown on. Drive each physical LED from one of
 * these tabs; the control page updates them live.
 */
export default function OutputPage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  const { surface } = use(params);

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      {isSurfaceId(surface) ? (
        <SurfaceOutput surfaceId={surface} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-500">
          <p className="text-lg font-medium">Unknown surface “{surface}”.</p>
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
