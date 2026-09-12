"use client";

import dynamic from "next/dynamic";

/**
 * Mounts the dashboard client-only.
 *
 * Why: every value in the shell arrives from a client-side fetch, so the
 * server-rendered output was only ever a skeleton — zeroed counts and a
 * "Loading…" pill. It bought nothing (no SEO surface, no earlier meaningful
 * paint) while creating a large tree for React to hydrate.
 *
 * That tree was the problem. Ad-blocker and security extensions stamp
 * attributes such as bis_skin_checked onto every div before React hydrates,
 * and React then reports a mismatch it cannot patch up. suppressHydrationWarning
 * is not a fix at this scale: it applies only to the element it is set on and
 * not to descendants, which is why the flag on the shell's root div left ~25
 * nested divs still mismatching. Tagging all of them would be unmaintainable
 * and would smother genuine mismatches.
 *
 * With ssr: false there is no server HTML for this subtree, so there is no
 * hydration comparison to fail. This removes the surface rather than silencing
 * the symptom. The map already mounts this way for a related reason (mapbox-gl
 * touches window at construction).
 *
 * The fallback below is deliberately a single element: it is the only thing
 * server-rendered here, so one suppressHydrationWarning genuinely covers it.
 */
const DashboardShell = dynamic(
  () => import("@/components/dashboard-shell").then((m) => m.DashboardShell),
  {
    ssr: false,
    loading: () => (
      <div
        suppressHydrationWarning
        className="text-muted flex h-dvh items-center justify-center text-sm"
      >
        Loading RAKSHA-REKHA…
      </div>
    ),
  },
);

export function DashboardClient() {
  return <DashboardShell />;
}
