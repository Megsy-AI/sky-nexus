import { createFileRoute } from "@tanstack/react-router";
import { DemoWorkspace } from "@/components/demo/DemoWorkspace";

export const Route = createFileRoute("/demo")({
  component: DemoWorkspace,
  head: () => ({ meta: [
    { title: "elgiza — تجربة بدون حساب" },
    { name: "description", content: "جرّب مساحة elgiza بدون حساب، مع محادثة توضيحية محلية لا تصل إلى بيانات خاصة." },
    { property: "og:title", content: "elgiza — تجربة بدون حساب" },
    { property: "og:description", content: "تجربة مستقلة وآمنة لمساحة elgiza بدون تسجيل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});