import { supabase } from '../lib/supabase';
import type { IncidentReport, RakshakHelper, SafePlace } from '../types/models';

type SafePlaceCategory = 'police' | 'hospital' | 'cafe' | 'fuel_station';

export interface Advertisement {
  id: string;
  title: string;
  description: string;
  icon_emoji: string;
  target_url?: string | null;
}

export interface SafetyZone {
  id: string;
  name: string;
  safety_level: 'red' | 'orange' | 'green';
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export interface AdminOverview {
  sosToday: number;
  activeRakshaks: number;
  pendingComplaints: number;
  activeSafePlaces: number;
}

function configuredClient() {
  if (!supabase) throw new Error('Raksha Sutra is not connected to its live service.');
  return supabase;
}

function mapCategory(category: SafePlaceCategory): SafePlace['type'] {
  if (category === 'fuel_station') return 'Fuel Station';
  return `${category[0].toUpperCase()}${category.slice(1)}` as SafePlace['type'];
}

export async function listActiveAdvertisements(): Promise<Advertisement[]> {
  const now = new Date().toISOString();
  const { data, error } = await configuredClient()
    .from('advertisements')
    .select('id, title, description, icon_emoji, target_url, starts_at, ends_at')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(5);
  if (error) throw error;
  return (data || []).filter((ad) => (!ad.starts_at || ad.starts_at <= now) && (!ad.ends_at || ad.ends_at >= now));
}

export async function listVerifiedRakshaks(): Promise<RakshakHelper[]> {
  const { data, error } = await configuredClient()
    .from('rakshak_profiles')
    .select('profile_id, coverage_area, average_rating, response_count, is_available, profiles!rakshak_profiles_profile_id_fkey(display_name)')
    .eq('status', 'verified')
    .order('verified_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((row: any) => {
    const name = row.profiles?.display_name || 'Verified Rakshak';
    return {
      id: row.profile_id,
      name,
      area: row.coverage_area || 'Area not shared',
      rating: Number(row.average_rating || 0).toFixed(1),
      eta: row.is_available ? 'Available now' : 'Currently unavailable',
      initials: name.split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase(),
      active: Boolean(row.is_available),
    };
  });
}

export async function listSafePlaces(): Promise<SafePlace[]> {
  const { data, error } = await configuredClient()
    .from('safe_places')
    .select('id, name, category, address, latitude, longitude')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    type: mapCategory(row.category as SafePlaceCategory),
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
  }));
}

export async function listSafetyZones(): Promise<SafetyZone[]> {
  const now = new Date().toISOString();
  const { data, error } = await configuredClient()
    .from('safety_zones')
    .select('id, name, safety_level, latitude, longitude, radius_meters, expires_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).filter((zone) => !zone.expires_at || zone.expires_at > now) as SafetyZone[];
}

export async function listPublishedReports(): Promise<IncidentReport[]> {
  const { data, error } = await configuredClient()
    .from('incident_reports')
    .select('id, place_label, description, sentiment, is_anonymous, moderation_status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    place: row.place_label,
    text: row.description,
    rating: row.sentiment === 'safe' ? 'Safe' : 'Unsafe',
    anonymous: row.is_anonymous,
    status: row.moderation_status === 'approved' ? 'Community report' : 'Pending review',
    time: new Date(row.created_at).toLocaleString(),
  }));
}

export async function createIncidentReport({
  place,
  text,
  rating,
  anonymous,
}: Pick<IncidentReport, 'place' | 'text' | 'rating' | 'anonymous'>) {
  const client = configuredClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in before submitting a report.');

  const { error } = await client.from('incident_reports').insert({
    user_id: authData.user.id,
    place_label: place.trim(),
    description: text.trim(),
    sentiment: rating.toLowerCase(),
    is_anonymous: anonymous,
  });
  if (error) throw error;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const client = configuredClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [sos, rakshaks, complaints, safePlaces] = await Promise.all([
    client.from('sos_events').select('id', { count: 'exact', head: true }).gte('started_at', startOfToday.toISOString()),
    client.from('rakshak_profiles').select('profile_id', { count: 'exact', head: true }).eq('status', 'verified').eq('is_available', true),
    client.from('rakshak_complaints').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('safe_places').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const error = sos.error || rakshaks.error || complaints.error || safePlaces.error;
  if (error) throw error;

  return {
    sosToday: sos.count || 0,
    activeRakshaks: rakshaks.count || 0,
    pendingComplaints: complaints.count || 0,
    activeSafePlaces: safePlaces.count || 0,
  };
}

