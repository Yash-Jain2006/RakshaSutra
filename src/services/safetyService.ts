import { supabase } from "../lib/supabase";
import type { EmergencyContact } from "../types/models";

export function configuredClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export function toContactModel(row: {
  id: string | number;
  name: string;
  relationship: string;
  phone_e164?: string | null;
  email?: string | null;
  confirmation_status: 'pending' | 'confirmed' | 'expired';
  notification_enabled?: boolean;
}): EmergencyContact {
  return {
    id: row.id,
    name: row.name,
    relation: row.relationship,
    phone: row.phone_e164 || "",
    email: row.email || "",
    confirmationStatus: row.confirmation_status,
    notificationEnabled: row.notification_enabled ?? true,
    initials: row.name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    color: "#6255ec",
  };
}

export async function listActiveRakshaks() {
  const { data, error } = await configuredClient()
    .from('rakshak_profiles')
    .select(`
      profile_id,
      coverage_area,
      coverage_latitude,
      coverage_longitude,
      average_rating,
      profiles!rakshak_profiles_profile_id_fkey ( display_name, avatar_url )
    `)
    .eq('status', 'verified');
    
  if (error) throw error;
  
  return (data || []).map((row: any) => ({
    id: row.profile_id,
    name: row.profiles?.display_name || 'Verified Rakshak',
    avatarUrl: row.profiles?.avatar_url,
    area: row.coverage_area,
    latitude: row.coverage_latitude,
    longitude: row.coverage_longitude,
    rating: row.average_rating,
    initials: (row.profiles?.display_name || 'VR').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase(),
  }));
}

export async function updateRakshakArea(userId: string, area: string, lat: number | null, lng: number | null) {
  const { data, error } = await configuredClient()
    .from('rakshak_profiles')
    .update({ 
      coverage_area: area,
      coverage_latitude: lat,
      coverage_longitude: lng
    })
    .eq('profile_id', userId);
    
  if (error) throw error;
  return data;
}

export async function listEmergencyContacts() {
  const { data, error } = await configuredClient()
    .from("emergency_contacts")
    .select(
      "id, name, relationship, phone_e164, email, notification_enabled, confirmation_status",
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(toContactModel);
}

export async function createEmergencyContact({
  userId,
  name,
  relationship,
  phone,
  email,
}: {
  userId?: string;
  name: string;
  relationship: string;
  phone?: string | null;
  email?: string | null;
}) {
  const { data, error } = await configuredClient().functions.invoke(
    "add-emergency-contact",
    {
      body: {
        name: name.trim(),
        relationship: relationship.trim(),
        phone: phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
      },
    },
  );
  if (error) throw error;
  return toContactModel(data.contact);
}

export async function deleteEmergencyContact(contactId: string) {
  const { error } = await configuredClient()
    .from("emergency_contacts")
    .delete()
    .eq("id", contactId);
  if (error) throw error;
}

export async function createSosEvent({
  userId,
  latitude,
  longitude,
  accuracyMeters,
  locationSource,
}: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  locationSource: string;
}) {
  const { data, error } = await configuredClient()
    .from("sos_events")
    .insert({
      user_id: userId,
      latitude,
      longitude,
      accuracy_meters: accuracyMeters ?? null,
      location_source: locationSource,
    })
    .select("id, map_session_token, started_at")
    .single();
  if (error) throw error;
  return data;
}

export async function dispatchSos(eventId: string, frontendUrl?: string) {
  const { data, error } = await configuredClient().functions.invoke(
    "dispatch-sos",
    {
      body: { eventId, frontendUrl },
    },
  );
  if (error) throw error;
  return data;
}

export async function dispatchJourney(
  destination: string, 
  contactIds: (string | number)[], 
  trackingLink: string, 
  status: 'started' | 'arrived' = 'started',
  etaSeconds?: number | null,
  distanceMeters?: number | null,
  transportMode?: string
) {
  const { data, error } = await configuredClient().functions.invoke(
    "dispatch-journey",
    {
      body: { destination, contactIds, trackingLink, status, etaSeconds, distanceMeters, transportMode },
    },
  );
  if (error) throw error;
  return data;
}

export async function dispatchLocationShare(trackingLink: string) {
  const { data, error } = await configuredClient().functions.invoke(
    "share-location",
    {
      body: { trackingLink },
    },
  );
  if (error) throw error;
  return data;
}

export async function notifySpecificRakshak(rakshakId: string, location: { lat: number, lng: number } | null) {
  const { data, error } = await configuredClient().functions.invoke(
    "notify-rakshak",
    {
      body: { rakshakId, location },
    },
  );

  if (error) throw error;
  return data;
}

export async function markSosSafe(eventId: string, status: 'safe' | 'cancelled' = "safe") {
  const now = new Date().toISOString();
  const patch =
    status === "cancelled"
      ? { status, cancelled_at: now, ended_at: now }
      : { status: "safe", safe_at: now, ended_at: now };
  const { error } = await configuredClient()
    .from("sos_events")
    .update(patch)
    .eq("id", eventId);
  if (error) throw error;
}

export async function submitRakshakComplaint({
  rakshakId,
  description,
}: {
  rakshakId: string;
  description: string;
}) {
  const { data: userData, error: userError } =
    await configuredClient().auth.getUser();
  if (userError || !userData.user)
    throw new Error("Please sign in before submitting a concern.");
  const { error } = await configuredClient().from("rakshak_complaints").insert({
    reporter_id: userData.user.id,
    rakshak_id: rakshakId,
    description: description.trim(),
  });
  if (error) throw error;
}

export async function updateSosLocation(
  eventId: string,
  latitude: number,
  longitude: number,
  accuracyMeters: number | null,
  locationSource: string
) {
  const { error } = await configuredClient()
    .from("sos_events")
    .update({
      latitude,
      longitude,
      accuracy_meters: accuracyMeters ?? null,
      location_source: locationSource,
    })
    .eq("id", eventId);
  if (error) throw error;
}

export async function listActivityHistory(userId: string) {
  const { data, error } = await configuredClient()
    .from("sos_events")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  
  // Transform SOS events to activity items
  return data.map((event: any) => ({
    id: event.id,
    type: 'sos',
    date: event.started_at,
    status: event.status,
    started_at: event.started_at
  }));
}

export async function acceptSosEvent(eventId: string, rakshakId: string) {
  const { data, error } = await configuredClient().rpc('accept_sos_event', {
    event_id: eventId,
    rakshak_id: rakshakId,
  });
  if (error) throw error;
  return data;
}

export async function getSosEventDetails(eventId: string) {
  const client = configuredClient();
  const { data, error } = await client
    .from("sos_events")
    .select(`
      id,
      user_id,
      latitude,
      longitude,
      status,
      started_at,
      created_at,
      profiles:user_id ( display_name )
    `)
    .eq("id", eventId)
    .maybeSingle();

  if (!error && data) return data;

  // Fallback if the join fails due to RLS or foreign key alias
  const { data: fallback, error: fbErr } = await client
    .from("sos_events")
    .select("id, user_id, latitude, longitude, status, started_at, created_at")
    .eq("id", eventId)
    .single();

  if (fbErr) throw fbErr;
  return { ...fallback, profiles: { display_name: 'Someone' } };
}

export async function getRakshakDetails(rakshakId: string) {
  const { data, error } = await configuredClient()
    .from("rakshak_profiles")
    .select(`
      profile_id,
      profiles:profile_id ( display_name, phone )
    `)
    .eq("profile_id", rakshakId)
    .single();
  if (error) throw error;
  return data;
}
