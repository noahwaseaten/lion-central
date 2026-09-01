import type { Metadata } from "next";

import { ArcCombinedOutput } from "@/components/arc/arc-combined-output";

export const metadata: Metadata = {
  title: "All surfaces · Output",
};

export default function CombinedOutputPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <ArcCombinedOutput />
    </main>
  );
}
