import { supabase } from '../lib/supabase';
import { RakshakAppItem } from '../components/admin/ManageRakshaks';

/**
 * Fetch all rakshak applications along with the user's name
 */
export async function getRakshakApplications(): Promise<RakshakAppItem[]> {
  if (!supabase) {
    console.warn('getRakshakApplications: supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('rakshak_applications')
    .select(`
      id,
      user_id,
      document_type,
      full_name_as_id,
      coverage_area,
      status,
      submitted_at
    `)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[AdminService] Error fetching applications:', error.message, error.details, error.hint);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn('[AdminService] No applications returned. RLS may be blocking access or no records exist.');
    return [];
  }

  // Map to UI model
  return data.map((row: any) => {
    let dateStr = 'Unknown';
    if (row.submitted_at) {
      const date = new Date(row.submitted_at);
      dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Convert document type enum to human readable
    const docTypeStr = row.document_type === 'aadhaar' ? 'Aadhaar'
      : row.document_type === 'pan' ? 'PAN Card'
        : 'Driving Licence';

    return {
      id: row.id,
      name: row.full_name_as_id,
      docType: docTypeStr,
      area: row.coverage_area,
      status: row.status,
      submittedAt: dateStr,
    };
  });
}

/**
 * Fetch all verified Rakshaks from the rakshak_profiles table
 */
export async function getVerifiedRakshaks(): Promise<RakshakAppItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('rakshak_profiles')
    .select(`
      profile_id,
      coverage_area,
      status,
      verified_at,
      profiles!rakshak_profiles_profile_id_fkey!inner (
        display_name
      )
    `)
    .eq('status', 'verified')
    .order('verified_at', { ascending: false });

  if (error) {
    console.error('[AdminService] Error fetching verified rakshaks:', error);
    return [];
  }

  return (data || []).map((row: any) => {
    let dateStr = 'Unknown';
    if (row.verified_at) {
      const date = new Date(row.verified_at);
      dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return {
      id: row.profile_id,
      name: row.profiles?.display_name || 'Unknown User',
      docType: 'N/A (Verified)',
      area: row.coverage_area || 'Unknown',
      status: 'verified',
      submittedAt: dateStr,
    };
  });
}

/**
 * Fetch signed URLs for a Rakshak application's identity documents
 */
export async function getApplicationDocuments(appId: string): Promise<{ urls: string[]; paths: string[] }> {
  if (!supabase) return { urls: [], paths: [] };

  const { data, error } = await supabase
    .from('rakshak_documents')
    .select('storage_path, side')
    .eq('application_id', appId)
    .order('side', { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) console.error('[AdminService] Error fetching documents:', error.message);
    return { urls: [], paths: [] };
  }

  const paths = data.map((d: any) => d.storage_path);

  const urlResults = await Promise.all(
    paths.map((path: string) =>
      supabase!.storage.from('identity-documents').createSignedUrl(path, 300)
    )
  );

  const urls = urlResults
    .map((r) => r.data?.signedUrl)
    .filter(Boolean) as string[];

  return { urls, paths };
}



/**
 * Approves a Rakshak application via secure RPC
 */
export async function approveRakshakApplication(appId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not initialized' };

  // 1. Fetch paths BEFORE RPC deletes them from the database
  const { data: docs } = await supabase.from('rakshak_documents').select('storage_path').eq('application_id', appId);

  // 2. Call RPC to update status and delete DB records
  const { error } = await supabase.rpc('approve_rakshak_application', {
    app_id: appId
  });

  if (error) {
    console.error('Error approving application:', error);
    return { success: false, error: error.message || 'Unknown RPC error' };
  }

  // 3. Delete physical files using Storage API
  if (docs && docs.length > 0) {
    const paths = docs.map(d => d.storage_path);
    await supabase.storage.from('identity-documents').remove(paths);
  }

  return { success: true };
}

/**
 * Rejects a Rakshak application via secure RPC
 */
export async function rejectRakshakApplication(appId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not initialized' };

  // 1. Fetch paths BEFORE RPC deletes them from the database
  const { data: docs } = await supabase.from('rakshak_documents').select('storage_path').eq('application_id', appId);

  // 2. Call RPC to update status and delete DB records
  const { error } = await supabase.rpc('reject_rakshak_application', {
    app_id: appId
  });

  if (error) {
    console.error('Error rejecting application:', error);
    return { success: false, error: error.message || 'Unknown RPC error' };
  }

  // 3. Delete physical files using Storage API
  if (docs && docs.length > 0) {
    const paths = docs.map(d => d.storage_path);
    await supabase.storage.from('identity-documents').remove(paths);
  }

  return { success: true };
}

/**
 * Deactivates a Rakshak via secure RPC
 */
export async function deactivateRakshak(profileId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not initialized' };

  const { error } = await supabase.rpc('deactivate_rakshak', {
    r_id: profileId
  });

  if (error) {
    console.error('Error deactivating rakshak:', error);
    return { success: false, error: error.message || 'Unknown RPC error' };
  }
  return { success: true };
}

/**
 * Fetch all SOS Events for the admin logs
 */
export async function getAllSosLogs() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('sos_events')
    .select(`
      id,
      status,
      location_source,
      started_at,
      ended_at,
      cancelled_at,
      safe_at,
      accepted_rakshak_id,
      profiles (
        display_name
      ),
      sos_event_deliveries (
        id,
        recipient_type,
        rakshak_id,
        status,
        channel,
        acknowledged_at,
        rakshak_profiles (
          coverage_area,
          profiles!rakshak_profiles_profile_id_fkey (
            display_name
          )
        )
      )
    `)
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[AdminService] Error fetching SOS logs:', error);
    return [];
  }

  return (data || []).map((row: any) => {
    let dateStr = 'Unknown';
    let durationStr = '--';

    if (row.started_at) {
      const started = new Date(row.started_at);
      
      const today = new Date();
      const isToday = started.getDate() === today.getDate() && started.getMonth() === today.getMonth() && started.getFullYear() === today.getFullYear();
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = started.getDate() === yesterday.getDate() && started.getMonth() === yesterday.getMonth() && started.getFullYear() === yesterday.getFullYear();

      const timeStr = started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      
      if (isToday) {
        dateStr = `Today, ${timeStr}`;
      } else if (isYesterday) {
        dateStr = `Yesterday, ${timeStr}`;
      } else {
        dateStr = started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + `, ${timeStr}`;
      }

      // Calculate duration if ended/cancelled/safe
      let endTime = null;
      if (row.ended_at) endTime = new Date(row.ended_at);
      else if (row.safe_at) endTime = new Date(row.safe_at);
      else if (row.cancelled_at) endTime = new Date(row.cancelled_at);

      if (endTime) {
        const diffMs = endTime.getTime() - started.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        durationStr = `${diffMins}m ${diffSecs}s`;
      } else {
        // Active
        const diffMs = Date.now() - started.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        durationStr = `${diffMins}m ${diffSecs}s`;
      }
    }

    const rakshakDeliveries = (row.sos_event_deliveries || []).filter(
      (del: any) => del.recipient_type === 'rakshak' || del.rakshak_id != null
    );

    const acceptedDelivery = rakshakDeliveries.find(
      (del: any) =>
        del.status === 'acknowledged' ||
        del.status === 'accepted' ||
        del.rakshak_id === row.accepted_rakshak_id ||
        (del.acknowledged_at && del.status !== 'failed')
    );

    let acceptedRakshak = null;
    if (acceptedDelivery) {
      const rProf = acceptedDelivery.rakshak_profiles;
      acceptedRakshak = {
        id: acceptedDelivery.rakshak_id || row.accepted_rakshak_id || '',
        name: rProf?.profiles?.display_name || 'Verified Rakshak',
        area: rProf?.coverage_area || '',
        time: acceptedDelivery.acknowledged_at
          ? new Date(acceptedDelivery.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : ''
      };
    } else if (row.accepted_rakshak_id) {
      acceptedRakshak = {
        id: row.accepted_rakshak_id,
        name: 'Verified Rakshak',
        area: '',
        time: ''
      };
    }

    return {
      id: row.id,
      userName: row.profiles?.display_name || 'Unknown User',
      startedAt: dateStr,
      status: row.status, // active, safe, cancelled
      locationSource: row.location_source, // precise, fallback, last_known
      deliveriesCount: row.sos_event_deliveries ? row.sos_event_deliveries.length : 0,
      duration: durationStr,
      flagged: false,
      acceptedRakshak,
      dispatchedRakshaksCount: rakshakDeliveries.length
    };
  });
}
