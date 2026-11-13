/** Light, dark, or follow the system. The choice lives in localStorage ("theme"); no entry means system. */
export type ThemePref = "light" | "dark" | "system";

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", pref);
  } catch {}
  const dark =
    pref === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : pref === "dark";
  document.documentElement.classList.toggle("dark", dark);
}
