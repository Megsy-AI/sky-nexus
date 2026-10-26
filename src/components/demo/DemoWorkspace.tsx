import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp, MessageSquare, Plus, LogIn, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { demoReply } from "@/lib/demo";

export function DemoWorkspace() {
  const [ar, setAr] = useState(true);
  const [dark, setDark] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const send = (value = input) => {
    if (!value.trim()) return;
    setMessages(previous => [...previous, { role: "user", text: value.trim() }, { role: "assistant", text: demoReply(value, ar) }]);
    setInput("");
  };
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };
  return <main className="elgiza-demo min-h-dvh bg-background text-foreground" dir={ar ? "rtl" : "ltr"}>
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
      <Link to="/demo" className="flex items-center gap-3"><BrandLogo className="h-8 w-8" /><span className="text-lg font-semibold">elgiza</span><span className="text-xs text-muted-foreground">{ar ? "تجربة بدون حساب" : "Account-free demo"}</span></Link>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setAr(!ar)}>{ar ? "English" : "العربية"}</Button>
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label={ar ? "تغيير المظهر" : "Toggle theme"} title={ar ? "تغيير المظهر" : "Toggle theme"}>{dark ? <Sun /> : <Moon />}</Button>
        <Button variant="outline" size="sm" asChild><Link to="/auth"><LogIn />{ar ? "تسجيل الدخول" : "Sign in"}</Link></Button>
      </div>
    </header>
    <div className="mx-auto flex max-w-6xl">
      <aside className="hidden min-h-[calc(100dvh-70px)] w-56 shrink-0 border-e border-border p-5 md:block">
        <Button variant="outline" className="w-full justify-start" onClick={() => setMessages([])}><Plus />{ar ? "محادثة جديدة" : "New chat"}</Button>
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><MessageSquare />{ar ? "المحادثة التجريبية" : "Sample conversation"}</div>
      </aside>
      <section className="flex min-h-[calc(100dvh-70px)] min-w-0 flex-1 flex-col px-5 pb-6 pt-8 md:px-10">
        <div className="mx-auto w-full max-w-2xl flex-1">
          {!messages.length ? <div className="py-12 md:py-24">
            <BrandLogo className="mb-6 h-12 w-12" />
            <h1 className="text-3xl font-semibold">{ar ? "أهلًا بيك في elgiza" : "Welcome to elgiza"}</h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{ar ? "عرض تجريبي بردود محفوظة، بدون تسجيل أو بيانات شخصية." : "A local demo with saved sample replies. No account or personal data."}</p>
            <div className="mt-8 flex flex-wrap gap-3">{(ar ? ["اكتب رسالة متابعة", "خطة لتنظيم يومي"] : ["Write a follow-up email", "Plan my day"]).map(text => <Button key={text} variant="outline" onClick={() => send(text)}>{text}</Button>)}</div>
          </div> : <div aria-live="polite" className="space-y-7 pb-10">{messages.map((message, index) => <article key={index} className={message.role === "user" ? "ms-auto max-w-[90%] rounded-lg bg-muted px-4 py-3" : "py-2"}><p className="mb-2 text-xs font-medium text-muted-foreground">{message.role === "user" ? (ar ? "أنت" : "You") : "elgiza · Demo"}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.text}</p></article>)}</div>}
        </div>
        <form onSubmit={e => { e.preventDefault(); send(); }} className="mx-auto flex w-full max-w-2xl items-end gap-3 rounded-lg border border-border bg-card p-3">
          <textarea aria-label={ar ? "رسالتك" : "Your message"} placeholder={ar ? "اكتب رسالتك…" : "Write a message…"} value={input} onChange={e => setInput(e.target.value)} rows={2} className="min-w-0 flex-1 resize-none bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground" />
          <Button variant="neutral" size="icon" type="submit" disabled={!input.trim()} aria-label={ar ? "إرسال" : "Send"}><ArrowUp /></Button>
        </form>
        <p className="mt-3 text-center text-xs text-muted-foreground">{ar ? "المحادثات هنا مؤقتة ولا يتم حفظها." : "Conversations here are temporary and are not saved."}</p>
      </section>
    </div>
  </main>;
}