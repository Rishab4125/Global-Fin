"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { buildPlan } from "./plan";
import { parseZerodhaTradebook } from "./parsers/zerodha";
import { executePlan, loadUserState } from "./server";
import type { ParseResult } from "./types";
import { toPreview } from "./view";

const MAX_BYTES = 5 * 1024 * 1024;

async function readFile(form: FormData): Promise<ParseResult> {
  const broker = form.get("broker");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { trades: [], skipped: [], error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) return { trades: [], skipped: [], error: "File is larger than 5 MB." };
  if (broker === "zerodha") return parseZerodhaTradebook(await file.text());
  return { trades: [], skipped: [], error: "That broker isn't supported yet." };
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
  const source = `${form.get("broker")}_csv`;
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
