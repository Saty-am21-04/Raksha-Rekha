import { DashboardClient } from "@/components/dashboard-client";

export const metadata = {
  title: "RAKSHA-REKHA — Hazard & Relocation Map",
};

/**
 * Stays a Server Component so it can export metadata. The shell is mounted
 * through DashboardClient, which disables SSR for it — see the note there.
 * `ssr: false` cannot be used directly from a Server Component.
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
