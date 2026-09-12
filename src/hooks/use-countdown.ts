"use client";

import { startTransition, useEffect, useState } from "react";

export function useCountdown(seconds: number | undefined, updatedAt: number) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!seconds) {
      startTransition(() => setRemaining(null));
      return;
    }
    const deadline = updatedAt + seconds * 1000;
    function tick() {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }
    startTransition(tick);
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [seconds, updatedAt]);
  return remaining;
}
