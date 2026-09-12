import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "@/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RAKSHA-REKHA — AI-driven GIS for disaster relocation planning" },
      {
        name: "description",
        content:
          "RAKSHA-REKHA maps hazard-based Red Zones live, scores habitations by risk, and ranks who needs relocation first. Built for SIH 2026.",
      },
      {
        property: "og:title",
        content: "RAKSHA-REKHA — AI-driven GIS for disaster relocation planning",
      },
      {
        property: "og:description",
        content:
          "The line that decides who moves before it's too late. Live risk scoring + safe-site capacity for disaster relocation in India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <LandingPage />;
}
