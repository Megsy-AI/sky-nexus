import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: SpaMount,
  head: () => ({ meta: [
    { title: "Sign in — elgiza" },
    { name: "description", content: "Sign in to elgiza or create your account for your AI workspace." },
    { property: "og:title", content: "Sign in — elgiza" },
    { property: "og:description", content: "Sign in or create an account to access your elgiza workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});