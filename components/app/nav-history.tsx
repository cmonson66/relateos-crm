"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const NAV_PREV_KEY = "np:navPrev";
export const NAV_CURRENT_KEY = "np:navCurrent";

/**
 * Remembers the last page you were on.
 *
 * document.referrer only updates on a FULL page load, so after a few
 * client-side navigations it points at wherever the tab originally landed.
 * That is why Back could say "Back to accounts" and then take you to a
 * contact - the label came from the referrer while router.back() used real
 * browser history. This keeps a session record that matches history.
 *
 * Mounted once in the app shell.
 */
export function NavHistory() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const current = sessionStorage.getItem(NAV_CURRENT_KEY);
      if (current && current !== pathname) {
        sessionStorage.setItem(NAV_PREV_KEY, current);
      }
      sessionStorage.setItem(NAV_CURRENT_KEY, pathname);
    } catch {
      // private mode or storage disabled - Back falls back to its list link
    }
  }, [pathname]);

  return null;
}
