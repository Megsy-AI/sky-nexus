import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: SpaMount,
  head: () => ({ meta: [
    { title: "Sign in — elgiza" },
    { name: "description", content: "Sign in to elgiza or explore the account-free sample workspace." },
    { property: "og:title", content: "Sign in — elgiza" },
    { property: "og:description", content: "Access your elgiza workspace or try the public demo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});