"use client";

import { useCallback, useEffect, useRef } from "react";

function generateMarker() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useModalHistory(open: boolean, onRequestClose: () => void) {
  const activeMarkerRef = useRef<string | null>(null);
  const closeRef = useRef(onRequestClose);

  useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const marker = generateMarker();
    const state = { ...(window.history.state || {}), __modalMarker: marker };
    window.history.pushState(state, "");
    activeMarkerRef.current = marker;

    const onPopState = (event: PopStateEvent) => {
      const markerInState = event.state?.__modalMarker ?? null;
      if (markerInState === activeMarkerRef.current) return;
      if (!activeMarkerRef.current) return;
      activeMarkerRef.current = null;
      closeRef.current();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [open]);

  return useCallback(() => {
    if (typeof window === "undefined") {
      onRequestClose();
      return;
    }

    const marker = activeMarkerRef.current;
    const currentMarker = window.history.state?.__modalMarker ?? null;
    if (marker && marker === currentMarker) {
      window.history.back();
      return;
    }

    activeMarkerRef.current = null;
    onRequestClose();
  }, [onRequestClose]);
}
