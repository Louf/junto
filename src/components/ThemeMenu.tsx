"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  THEME_KEY,
  applyThemePref,
  readThemePref,
  type ThemePref,
} from "@/lib/theme";

const CHANGE = "junto-theme-change";

// Other tabs report through `storage`; this tab through its own event.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

const SUN = (
  <>
    <circle cx="8" cy="8" r="2.75" />
    <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" />
  </>
);
const MOON = <path d="M13.25 9.6A5.5 5.5 0 0 1 6.4 2.75a5.5 5.5 0 1 0 6.85 6.85Z" />;
const DEVICE = (
  <>
    <rect x="2.5" y="3" width="11" height="7.5" rx="1.5" />
    <path d="M6 13.5h4M8 10.5v3" />
  </>
);

const OPTIONS: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Match device", icon: DEVICE },
  { value: "light", label: "Light", icon: SUN },
  { value: "dark", label: "Dark", icon: MOON },
];

/**
 * Sun/moon button for the top-right of a page, opening a three-way menu.
 *
 * The button's icon follows the page's actual appearance through the `dark:`
 * variant, so it's right on first paint with no JS. Only the menu needs the
 * saved choice, and it can't be open before hydration anyway.
 */
export function ThemeMenu() {
  const pref = useSyncExternalStore<ThemePref>(
    subscribe,
    readThemePref,
    () => "system",
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keeps <html> in step when another tab changes the setting.
  useEffect(() => applyThemePref(pref), [pref]);

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Land on the current choice so arrow keys start from somewhere sensible.
  useEffect(() => {
    if (!open) return;
    const i = OPTIONS.findIndex((o) => o.value === pref);
    itemRefs.current[i]?.focus();
  }, [open, pref]);

  function choose(next: ThemePref) {
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked: still switch for this page view.
      applyThemePref(next);
    }
    window.dispatchEvent(new Event(CHANGE));
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = itemRefs.current;
    const at = items.findIndex((el) => el === document.activeElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    items[(at + step + items.length) % items.length]?.focus();
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Theme"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition hover:text-foreground active:scale-95"
      >
        <Icon className="dark:hidden">{SUN}</Icon>
        <Icon className="hidden dark:block">{MOON}</Icon>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {OPTIONS.map((o, i) => {
            const on = pref === o.value;
            return (
              <button
                key={o.value}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => choose(o.value)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] outline-none transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 ${
                  on ? "text-foreground font-medium" : "text-foreground/80"
                }`}
              >
                <Icon className="text-muted">{o.icon}</Icon>
                <span className="flex-1">{o.label}</span>
                {on && (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 text-accent"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Icon({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
