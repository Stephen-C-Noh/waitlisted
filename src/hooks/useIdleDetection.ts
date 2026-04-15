"use client";

import { useEffect, useRef } from "react";

interface Options {
  /**
   * Fires on the first detected interaction. Used by /slideshow to navigate
   * to /waitlist on any touch. If absent, touches are ignored.
   */
  onActivity?: () => void;
  /**
   * Fires after `idleTimeoutMs` of no activity. Used by other public pages
   * to return to /slideshow. If absent, the idle timer is disabled.
   */
  onIdle?: () => void;
  idleTimeoutMs?: number;
  /**
   * Events to listen for. Waitlisted runs on a touch-only tablet, so
   * defaults to touchstart. Override to add pointerdown/keydown when
   * testing on a laptop.
   */
  events?: Array<keyof WindowEventMap>;
}

const DEFAULT_EVENTS: Array<keyof WindowEventMap> = ["touchstart"];

export function useIdleDetection({
  onActivity,
  onIdle,
  idleTimeoutMs,
  events = DEFAULT_EVENTS,
}: Options) {
  const onActivityRef = useRef(onActivity);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onActivityRef.current = onActivity;
    onIdleRef.current = onIdle;
  }, [onActivity, onIdle]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const armTimer = () => {
      if (!onIdleRef.current || !idleTimeoutMs) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current?.(), idleTimeoutMs);
    };

    const handler = () => {
      onActivityRef.current?.();
      armTimer();
    };

    for (const evt of events) {
      window.addEventListener(evt, handler, { passive: true });
    }
    armTimer();

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, handler);
      }
      if (timer) clearTimeout(timer);
    };
  }, [events, idleTimeoutMs]);
}
