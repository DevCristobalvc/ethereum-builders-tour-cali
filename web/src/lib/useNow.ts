"use client";
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
// Whole seconds keep the snapshot stable between calls within the same tick.
const snapshot = () => Math.floor(Date.now() / 1000) * 1000;

/** Current time in ms, refreshed every second; keeps Date.now() out of render. */
export const useNow = () => useSyncExternalStore(subscribe, snapshot, () => 0);
