"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { buildPlan } from "./plan";
import { parseBrokerFile } from "./parsers/detect";
import { executePlan, loadUserState } from "./server";
import type { ParsedFile } from "./types";
import { toPreview } from "./view";

const MAX_BYTES = 5 * 1024 * 1024;

async function readFile(form: FormData): Promise<ParsedFile> {
  const broker = form.get("broker");
  const file = form.get("file");
  const fail = (error: string): ParsedFile => ({ trades: [], skipped: [], source: "", error });
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file to upload.");
  if (file.size > MAX_BYTES) return fail("File is larger than 5 MB.");
  return parseBrokerFile(String(broker), file);
}

function readChoices(form: FormData) {
  const mapping = new Map<string, string>();
  const includeDuplicates = new Set<string>();
  for (const [name, value] of form.entries()) {
    if (typeof value !== "string") continue;
    if (name.startsWith("map:") && value) mapping.set(name.slice(4), value);
    else if (name.startsWith("dup:") && value === "on") includeDuplicates.add(name.slice(4));
  }
  return { mapping, includeDuplicates, replaceEstimated: form.get("replaceEstimated") === "on" };
}

async function makePlan(userId: string, form: FormData) {
  const parsed = await readFile(form);
  if (parsed.error) return { error: parsed.error } as const;
  if (!parsed.trades.length) return { error: "No importable equity trades found in this file." } as const;
  const state = await loadUserState(userId);
  const source = parsed.source;
  const plan = buildPlan({ trades: parsed.trades, source, ...state, ...readChoices(form) });
  return { plan, state, source, skipped: parsed.skipped } as const;
}

export async function previewImportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const r = await makePlan(user.id, form);
  if ("error" in r) return { error: r.error };
  return { importPreview: toPreview("upload", r.plan, r.state.assets, r.skipped) };
}

export async function commitImportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const r = await makePlan(user.id, form);
  if ("error" in r) return { error: r.error };

  try {
    await executePlan(user.id, r.source, r.plan);
  } catch {
    return { error: "Import failed and nothing was saved. If you just uploaded this file, try previewing again." };
  }

  revalidatePath("/", "layout");
  const done = {
    buys: r.plan.lots.length,
    sells: r.plan.sales.length,
    skipped: r.plan.rows.filter((x) => !x.include && x.status !== "error").length,
    failed: r.plan.rows.filter((x) => x.status === "error").length,
  };
  return { ok: true, nonce: Date.now(), importDone: done };
}
