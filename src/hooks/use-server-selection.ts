"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

const STORAGE_KEY = "blocky-ui.server-selection.v1";
const CHANGE_EVENT = "blocky-ui:server-selection";
const selectionSchema = z.object({
  view: z.array(z.string()).default([]),
  blocking: z.array(z.string()).default([]),
  maintenance: z.array(z.string()).default([]),
  query: z.array(z.string()).default([]),
});
type Scope = keyof z.infer<typeof selectionSchema>;
let fallback: string | null = null;

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

function snapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

function parseSelection(raw: string | null) {
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    return selectionSchema.parse(value);
  } catch {
    return selectionSchema.parse({});
  }
}

export function useServerSelection(ids: string[]) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const excluded = parseSelection(raw);

  function selected(scope: Scope) {
    const result = ids.filter((id) => !excluded[scope].includes(id));
    return result.length ? result : ids.slice(0, 1);
  }

  function toggle(scope: Scope, id: string) {
    const current = selected(scope);
    if (current.length === 1 && current.includes(id)) {
      return;
    }
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    const value = JSON.stringify({
      ...excluded,
      [scope]: ids.filter((item) => !next.includes(item)),
    });
    fallback = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return { selected, toggle };
}
