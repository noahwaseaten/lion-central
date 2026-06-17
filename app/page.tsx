import { ArcWorkspace } from "@/components/control/workspace/arc-workspace";

/**
 * `/` — the unified Arc Control app: one workspace driving every zone with an
 * interactive 2D view of the whole arc. Outputs open separately at
 * `/output/<surface>` and stay in sync via shared (cross-tab) state.
 */
export default function Home() {
  return <ArcWorkspace />;
}
