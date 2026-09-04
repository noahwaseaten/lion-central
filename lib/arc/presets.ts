import type { ArcConfig } from "./layout-model";

/** A named full-layout snapshot the operator can save and switch back to. */
export interface Preset {
  id: string;
  name: string;
  config: ArcConfig;
}
