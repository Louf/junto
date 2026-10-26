/**
 * Light/dark theme. "system" follows the device and is the default; picking
 * light or dark is remembered per browser in localStorage and applied as
 * data-theme on <html>, which globals.css keys the palette off.
 */

export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "junto-theme";

/** Page backgrounds, for the browser chrome (theme-color). */
export const THEME_COLORS = { light: "#f7f7f8", dark: "#09090b" } as const;

/**
 * Inlined in <head> so a saved choice is on <html> before the first paint.
 * Kept tiny and dependency-free since it runs before anything else.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);

  // The theme-color tags pick by media query, i.e. by the device setting. With
  // an override, point both at the chosen colour so the browser bar matches.
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((m) => {
      const own = m.media.includes("dark") ? "dark" : "light";
      m.content = THEME_COLORS[pref === "system" ? own : pref];
    });
}
