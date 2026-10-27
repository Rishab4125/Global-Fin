"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { ActionState } from "@/features/portfolio/actionState";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Calls a server action with the form's data without React's automatic form reset,
 * so inputs survive validation errors and previews. Resets only when `resetOnOk` and ok.
 */
export function useServerForm(action: Action, resetOnOk = false) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  // A saved-confirmation should disappear on its own.
  useEffect(() => {
    if (!state.ok || !resetOnOk) return;
    const id = setTimeout(() => setState((s) => ({ ...s, ok: false })), 4000);
    return () => clearTimeout(id);
  }, [state, resetOnOk]);

  const run = (customAction: Action = action) => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    startTransition(async () => {
      const result = await customAction({}, data);
      setState(result);
      if (result.ok && resetOnOk) formRef.current?.reset();
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run();
  };

  return { formRef, state, pending, onSubmit, run };
}
