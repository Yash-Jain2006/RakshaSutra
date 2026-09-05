import { supabase } from '../lib/supabase';
import type { JourneyStatus } from '../types/enums';

export interface LiveJourney {
  id: string;
  destination: string;
  status: JourneyStatus;
}

function configuredClient() {
  if (!supabase) throw new Error('Raksha Sutra is not connected to its live service.');
  return supabase;
}

export async function getCurrentJourney(userId: string): Promise<LiveJourney | null> {
  const { data, error } = await configuredClient()
    .from('journeys')
    .select('id, destination_name, status')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, destination: data.destination_name || 'Destination not provided', status: data.status as JourneyStatus };
}

export async function startLiveJourney(userId: string, destination: string, contactIds: Array<string | number>): Promise<LiveJourney> {
  const client = configuredClient();
  const { data, error } = await client
    .from('journeys')
    .insert({ user_id: userId, destination_name: destination, status: 'active' })
    .select('id, destination_name, status')
    .single();
  if (error) throw error;

  const viewerIds = contactIds.filter((id): id is string => typeof id === 'string');
  if (viewerIds.length) {
    const { error: viewersError } = await client
      .from('journey_viewers')
      .insert(viewerIds.map((contact_id) => ({ journey_id: data.id, contact_id })));
    if (viewersError) {
      await client.from('journeys').delete().eq('id', data.id);
      throw viewersError;
    }
  }
  return { id: data.id, destination: data.destination_name || destination, status: data.status as JourneyStatus };
}

export async function updateLiveJourney(id: string, status: JourneyStatus) {
  const terminal = status === 'arrived' || status === 'cancelled' || status === 'expired';
  const { error } = await configuredClient()
    .from('journeys')
    .update({ status, ended_at: terminal ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function updateLiveJourneyLocation(journeyId: string, latitude: number, longitude: number, accuracyMeters: number | null) {
  const { error } = await configuredClient()
    .from('journey_location_points')
    .insert({
      journey_id: journeyId,
      latitude,
      longitude,
      accuracy_meters: accuracyMeters
    });
  if (error) throw error;
}
