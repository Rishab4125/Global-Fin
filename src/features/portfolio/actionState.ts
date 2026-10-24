import type { RealisedRow } from "@/domain/gains";
import type { ImportDone, ImportPreview } from "@/features/import/view";

export interface ActionState {
  error?: string;
  ok?: boolean;
  preview?: RealisedRow;
  /** Tax that would apply if "include tax effect" were Yes (shown when it is No). */
  taxIfApplied?: number;
  /** Bumped on each success so forms can reset. */
  nonce?: number;
  importPreview?: ImportPreview;
  importDone?: ImportDone;
}
