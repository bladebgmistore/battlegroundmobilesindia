"use client";

import { createContext, useContext, type ReactNode } from "react";

export type PublicSettingsMap = Record<string, string>;

export const SettingsContext = createContext<PublicSettingsMap | null>(null);

export function SettingsProvider({ value, children }: { value: PublicSettingsMap; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useServerSettings(): PublicSettingsMap | null {
  return useContext(SettingsContext);
}
