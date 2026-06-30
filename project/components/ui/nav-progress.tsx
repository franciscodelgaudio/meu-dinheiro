"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";

function NavProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const barRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef(pathname + searchParams.toString());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const navigatingRef = useRef(false);
  // Prevents false triggers from Next.js internal history calls during initial mount
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = true;
  }, []);

  const start = () => {
    const bar = barRef.current;
    if (!bar || !readyRef.current || navigatingRef.current) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    navigatingRef.current = true;
    // DOM-only: no setState, safe to call from useInsertionEffect contexts
    bar.style.transition = "none";
    bar.style.opacity = "1";
    bar.style.width = "0%";
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (!barRef.current || !navigatingRef.current) return;
        barRef.current.style.transition = "width 700ms cubic-bezier(0.05, 0.9, 0.25, 1)";
        barRef.current.style.width = "72%";
      });
    });
  };

  const complete = () => {
    const bar = barRef.current;
    if (!bar) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    navigatingRef.current = false;
    bar.style.transition = "width 200ms ease-in";
    bar.style.width = "100%";
    timerRef.current = setTimeout(() => {
      if (!barRef.current) return;
      barRef.current.style.transition = "opacity 300ms ease-out";
      barRef.current.style.opacity = "0";
      timerRef.current = setTimeout(() => {
        if (!barRef.current) return;
        barRef.current.style.transition = "none";
        barRef.current.style.width = "0%";
      }, 300);
    }, 200);
  };

  useEffect(() => {
    const handleStart = () => start();
    window.addEventListener("nav:start", handleStart);

    const origPush = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args) {
      window.dispatchEvent(new Event("nav:start"));
      return origPush(...args);
    };
    window.history.replaceState = function (...args) {
      window.dispatchEvent(new Event("nav:start"));
      return origReplace(...args);
    };

    return () => {
      window.removeEventListener("nav:start", handleStart);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = pathname + searchParams.toString();
    if (current !== pathRef.current) {
      pathRef.current = current;
      complete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div
      ref={barRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[200] h-[2px] bg-emerald-500"
      style={{ width: "0%", opacity: 0 }}
    />
  );
}

export function NavProgress() {
  return (
    <Suspense>
      <NavProgressBar />
    </Suspense>
  );
}
