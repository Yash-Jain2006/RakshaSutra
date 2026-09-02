import { supabase } from "../lib/supabase";

function configuredClient() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.",
    );
  return supabase;
}

export async function getCurrentSession() {
  const { data, error } = await configuredClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback: (session: any) => void) {
  return configuredClient().auth.onAuthStateChange((_event, session) =>
    callback(session),
  );
}

export async function sendMagicLink({
  email,
  displayName,
  preferredLanguage = "en",
}: {
  email: string;
  displayName?: string;
  preferredLanguage?: string;
}) {
  const redirectTo = import.meta.env.VITE_APP_URL || window.location.origin;
  const { error } = await configuredClient().auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        display_name: displayName?.trim() || undefined,
        preferred_language: preferredLanguage,
      },
    },
  });
  if (error) throw error;
}

export async function signInWithEmailPassword({ email, password }: { email: string; password: string }) {
  const { error } = await configuredClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword({
  email,
  password,
  displayName,
  age,
  phone,
}: {
  email: string;
  password: string;
  displayName: string;
  age: string;
  phone: string;
}) {
  const redirectTo = import.meta.env.VITE_APP_URL || window.location.origin;
  const { error } = await configuredClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: { display_name: displayName.trim(), age, phone },
    },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = import.meta.env.VITE_APP_URL || window.location.origin;
  const { error } = await configuredClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await configuredClient().auth.signOut();
  if (error) throw error;
}
