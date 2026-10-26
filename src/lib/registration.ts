import type { SupabaseClient } from "@supabase/supabase-js";

/** Use the configured identity service, respecting its email-confirmation policy. */
export async function registerAccount(
  auth: Pick<SupabaseClient["auth"], "signUp">,
  email: string,
  password: string,
  origin: string,
) {
  const { data, error } = await auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: origin },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Could not create account");
  return { status: data.session ? "signed-in" as const : "confirmation-required" as const };
}