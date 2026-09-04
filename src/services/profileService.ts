import { supabase } from '../lib/supabase';
import type { Profile } from '../types/models';

function configuredClient() {
  if (!supabase) throw new Error('Raksha Sutra is not connected to its live service.');
  return supabase;
}

export async function ensureProfileExists(displayName: string) {
  const { error } = await configuredClient().rpc('ensure_profile_exists', {
    user_name: displayName.trim() || 'User',
  });
  if (error) throw error;
}

export async function getMyProfile(): Promise<Profile> {
  const client = configuredClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in to continue.');

  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, role, account_status, preferred_language, city, phone, avatar_url, created_at')
    .eq('id', authData.user.id)
    .single();

  if (error) {
    // If phone column doesn't exist yet, fallback to selecting without phone
    const { data: fallbackData, error: fallbackError } = await client
      .from('profiles')
      .select('id, display_name, role, account_status, preferred_language, city, avatar_url, created_at')
      .eq('id', authData.user.id)
      .single();
    if (fallbackError) throw fallbackError;
    return { ...fallbackData, phone: authData.user.phone || authData.user.user_metadata?.phone || null } as Profile;
  }

  // If profile.phone is null, fallback to auth user's phone if present
  const resolvedPhone = data.phone || authData.user.phone || authData.user.user_metadata?.phone || null;
  return { ...data, phone: resolvedPhone } as Profile;
}

export async function updateMyProfile(displayName: string, phone?: string | null) {
  const client = configuredClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in to continue.');

  const normalizedName = displayName.trim();
  const normalizedPhone = phone !== undefined ? (phone?.trim() || null) : undefined;

  const profileUpdates: Record<string, any> = { display_name: normalizedName };
  if (normalizedPhone !== undefined) {
    profileUpdates.phone = normalizedPhone;
  }

  const authUpdates: Record<string, any> = {
    data: {
      display_name: normalizedName,
      ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
    },
  };

  // 1. Update public.profiles
  const { error: profileError } = await client
    .from('profiles')
    .update(profileUpdates)
    .eq('id', authData.user.id);

  // If column doesn't exist yet in Supabase, retry without phone to not block user
  if (profileError && profileError.message?.includes('phone')) {
    console.warn('phone column not yet added to profiles table; saving display_name only to profiles', profileError);
    await client.from('profiles').update({ display_name: normalizedName }).eq('id', authData.user.id);
  } else if (profileError) {
    throw profileError;
  }

  // 2. Update auth user metadata
  const { error: authUpdateError } = await client.auth.updateUser(authUpdates);
  if (authUpdateError) {
    console.warn('auth.updateUser error:', authUpdateError);
  }
}
