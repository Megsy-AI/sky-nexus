/** Public, local-only sample replies. Never attach an account or invoke protected services. */
export function demoReply(input: string, arabic: boolean): string {
  if (!input.trim()) return "";
  if (/plan|خطة|خطه|تنظيم/i.test(input)) {
    return arabic
      ? "مثال تجريبي لخطة يومك:\n1. اختار أهم مهمة وخصص لها ساعة.\n2. خلّص الرسائل والمتابعات في وقت محدد.\n3. راجع اللي أنجزته وحدد أول خطوة لبكرة."
      : "Sample daily plan:\n1. Choose your main task and reserve one focused hour.\n2. Batch messages and follow-ups.\n3. Review your progress and choose tomorrow’s first step.";
  }
  if (/write|email|اكتب|رسالة|رساله/i.test(input)) {
    return arabic
      ? "نموذج رسالة تجريبي:\nمرحبًا،\nحبيت أتابع معاك بخصوص آخر تحديث للمشروع. هل ممكن تبعتلي حالة العمل والخطوة الجاية؟\nشكرًا لوقتك."
      : "Sample message:\nHi,\nI’m following up on the latest project update. Could you share the current status and next step?\nThanks for your time.";
  }
  return arabic
    ? "ده رد توضيحي محفوظ للتجربة، مش توليد ذكاء اصطناعي مباشر. تقدر تجرب كتابة رسالة أو تنظيم يومك؛ الخدمات الحقيقية وحفظ المحادثات محتاجين حساب."
    : "This is a saved sample reply, not a live AI generation. Try drafting a message or planning your day. Live services and saved conversations require an account.";
}