"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/** A JSON value kept in localStorage, shared across components and tabs, and safe for server rendering. */
export function useLocalStorageJson<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (e: StorageEvent) => e.key === key && onChange();
      const onLocal = (e: Event) => (e as CustomEvent).detail === key && onChange();
      window.addEventListener("storage", onStorage);
      window.addEventListener("local-json", onLocal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("local-json", onLocal);
      };
    },
    [key],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const value = useMemo<T>(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // fallback is a constant default; only the stored string drives updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      let prev = fallback;
      try {
        const cur = localStorage.getItem(key);
        if (cur !== null) prev = JSON.parse(cur);
      } catch {
        /* ignore unreadable value */
      }
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* storage full or blocked: the change is lost after reload */
      }
      window.dispatchEvent(new CustomEvent("local-json", { detail: key }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

/** True when the visitor asked the system for reduced motion. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
