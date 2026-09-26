"use client";
import { useEffect, useRef } from "react";

/** Signs the user out after a period without keyboard or pointer activity. */
export function IdleTimeout({ minutes, onIdle }: { minutes: number; onIdle: () => Promise<void> }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void onIdle(), minutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "scroll", "pointermove"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [minutes, onIdle]);
  return null;
}
