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
    .select('id, display_name, role, account_status, preferred_language, city, avatar_url, created_at')
    .eq('id', authData.user.id)
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function updateMyProfile(displayName: string) {
  const client = configuredClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in to continue.');

  const normalizedName = displayName.trim();
  const [{ error: profileError }, { error: authUpdateError }] = await Promise.all([
    client.from('profiles').update({ display_name: normalizedName }).eq('id', authData.user.id),
    client.auth.updateUser({ data: { display_name: normalizedName } }),
  ]);

  if (profileError) throw profileError;
  if (authUpdateError) throw authUpdateError;
}
