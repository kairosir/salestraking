"use client";

import { useCallback, useEffect, useRef } from "react";

function generateMarker() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useModalHistory(open: boolean, onRequestClose: () => void) {
  const topMarkerRef = useRef<string | null>(null);
  const closeRef = useRef(onRequestClose);

  useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const baseMarker = generateMarker();
    const topMarker = generateMarker();
    const currentState = window.history.state || {};

    // Two entries guarantee that one browser-back closes modal first,
    // without jumping to the previous page route.
    window.history.pushState({ ...currentState, __modalBase: baseMarker }, "");
    window.history.pushState({ ...currentState, __modalBase: baseMarker, __modalTop: topMarker }, "");
    topMarkerRef.current = topMarker;

    const onPopState = (event: PopStateEvent) => {
      if (!topMarkerRef.current) return;
      const markerInState = event.state?.__modalTop ?? null;
      if (markerInState === topMarkerRef.current) return;

      topMarkerRef.current = null;
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

    const marker = topMarkerRef.current;
    const currentMarker = window.history.state?.__modalTop ?? null;
    if (marker && marker === currentMarker) {
      window.history.back();
      return;
    }

    topMarkerRef.current = null;
    onRequestClose();
  }, [onRequestClose]);
}
