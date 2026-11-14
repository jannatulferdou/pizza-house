import { useSyncExternalStore, type ReactNode } from "react";
import { bn } from "./translations";
type Language = "en" | "bn";
let language: Language = "en";
try { language = localStorage.getItem("ph-language") === "bn" ? "bn" : "en"; } catch { /* Storage is optional. */ }
document.documentElement.lang = language;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function translated(text: string) {
  if (language !== "bn") return text;
  const normalized = text.replace(/\s+/g, " ").trim();
  return bn[normalized] || text;
}
/** Translate presentation text; product names, addresses and other customer data stay intact. */
export function T({ children, space = false }: { children: ReactNode; space?: boolean }): ReactNode {
  useSyncExternalStore(subscribe, () => language);
  if (typeof children !== "string") return children;
  const value = translated(children);
  return space && /\S/.test(value) ? ` ${value} ` : value;
}
export function LanguageSwitch() {
  const current = useSyncExternalStore(subscribe, () => language);
  return <button type="button" className="language-switch" aria-label={current === "en" ? "Switch to Bengali" : "Switch to English"} onClick={() => {
    language = current === "en" ? "bn" : "en";
    document.documentElement.lang = language;
    try { localStorage.setItem("ph-language", language); } catch { /* Storage is optional. */ }
    listeners.forEach(listener => listener());
  }}>{current === "en" ? "বাংলা" : "English"}</button>;
}
