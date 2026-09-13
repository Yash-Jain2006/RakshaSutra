import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, MapPin, Search, RefreshCw, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { configuredClient } from '../../services/safetyService';

interface AcceptedRakshakInfo {
  id: string;
  name: string;
  area?: string;
  time?: string;
}

interface SosLogItem {
  id: string;
  userName: string;
  startedAt: string;
  status: 'active' | 'safe' | 'cancelled';
  locationSource: string;
  deliveriesCount: number;
  duration: string;
  flagged?: boolean;
  acceptedRakshak?: AcceptedRakshakInfo | null;
  dispatchedRakshaksCount: number;
}

export const ManageSosLogs: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [logs, setLogs] = useState<SosLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await configuredClient()
      .from('sos_events')
      .select(`
        id,
        status,
        location_source,
        started_at,
        cancelled_at,
        ended_at,
        accepted_rakshak_id,
        profiles ( display_name ),
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
      .limit(50);
      
    if (data && !error) {
      const mappedLogs: SosLogItem[] = data.map((e: any) => {
        // Calculate duration
        const start = new Date(e.started_at).getTime();
        const endTimeStr = e.safe_at || e.cancelled_at || e.ended_at;
        const end = endTimeStr ? new Date(endTimeStr).getTime() : Date.now();
        const diffSecs = Math.floor((end - start) / 1000);
        const mins = Math.floor(diffSecs / 60);
        const secs = diffSecs % 60;
        const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        // Format date
        const d = new Date(e.started_at);
        const dateStr = d.toLocaleDateString() === new Date().toLocaleDateString() 
          ? `Today, ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
          : d.toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'});

        // Identify accepted / acknowledged rakshak delivery
        const rakshakDeliveries = (e.sos_event_deliveries || []).filter(
          (del: any) => del.recipient_type === 'rakshak' || del.rakshak_id != null
        );

        const acceptedDelivery = rakshakDeliveries.find(
          (del: any) =>
            del.status === 'acknowledged' ||
            del.status === 'accepted' ||
            del.rakshak_id === e.accepted_rakshak_id ||
            (del.acknowledged_at && del.status !== 'failed')
        );

        let acceptedRakshak: AcceptedRakshakInfo | null = null;
        if (acceptedDelivery) {
          const rProf = acceptedDelivery.rakshak_profiles;
          const displayName = rProf?.profiles?.display_name || 'Verified Rakshak';
          const area = rProf?.coverage_area || '';
          let ackTime = '';
          if (acceptedDelivery.acknowledged_at) {
            const ackDate = new Date(acceptedDelivery.acknowledged_at);
            ackTime = ackDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }

          acceptedRakshak = {
            id: acceptedDelivery.rakshak_id || e.accepted_rakshak_id || '',
            name: displayName,
            area: area,
            time: ackTime,
          };
        } else if (e.accepted_rakshak_id) {
          // Fallback if the delivery record wasn't updated but accepted_rakshak_id is set
          acceptedRakshak = {
            id: e.accepted_rakshak_id,
            name: 'Verified Rakshak', // Will be populated by batch fetch
          };
        }

        return {
          id: e.id,
          userName: e.profiles?.display_name || 'Unknown User',
          startedAt: dateStr,
          status: e.status,
          locationSource: e.location_source,
          deliveriesCount: e.sos_event_deliveries?.length || 0,
          duration: duration,
          flagged: false,
          acceptedRakshak,
          dispatchedRakshaksCount: rakshakDeliveries.length,
        };
      });

      // Batch fetch missing profile names and coverage areas for acceptedRakshaks
      const missingProfileIds = mappedLogs
        .filter(l => l.acceptedRakshak && l.acceptedRakshak.id && (l.acceptedRakshak.name === 'Verified Rakshak' || !l.acceptedRakshak.area))
        .map(l => l.acceptedRakshak!.id);
        
      if (missingProfileIds.length > 0) {
        const [{ data: profilesData }, { data: rakshakProfilesData }] = await Promise.all([
          configuredClient()
            .from('profiles')
            .select('id, display_name')
            .in('id', missingProfileIds),
          configuredClient()
            .from('rakshak_profiles')
            .select('profile_id, coverage_area')
            .in('profile_id', missingProfileIds)
        ]);
          
        const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p.display_name]));
        const areaMap = new Map((rakshakProfilesData || []).map((r: any) => [r.profile_id, r.coverage_area]));

        mappedLogs.forEach(l => {
          if (l.acceptedRakshak && l.acceptedRakshak.id) {
            if (profileMap.has(l.acceptedRakshak.id)) {
              l.acceptedRakshak.name = profileMap.get(l.acceptedRakshak.id) || l.acceptedRakshak.name;
            }
            if (!l.acceptedRakshak.area && areaMap.has(l.acceptedRakshak.id)) {
              l.acceptedRakshak.area = areaMap.get(l.acceptedRakshak.id) || '';
            }
          }
        });
      }

      setLogs(mappedLogs);
    }
    setLoading(false);
  };

  const clearAllLogs = async () => {
    if (!window.confirm('Are you sure you want to clear ALL SOS logs in the database? This cannot be undone.')) return;
    
    setLoading(true);
    try {
      // 1. Try secure RPC first
      const { error: rpcError } = await configuredClient().rpc('clear_all_sos_events');
      
      if (rpcError) {
        console.warn('RPC clear_all_sos_events failed, attempting direct table delete:', rpcError);
        // Fallback: Delete child rows first to satisfy foreign key constraints
        await configuredClient().from('sos_event_updates').delete().not('id', 'is', null);
        await configuredClient().from('sos_event_deliveries').delete().not('id', 'is', null);
        await configuredClient().from('sos_live_locations').delete().not('id', 'is', null);
        await configuredClient().from('sos_location_history').delete().not('id', 'is', null);

        const { error: deleteError } = await configuredClient()
          .from('sos_events')
          .delete()
          .not('id', 'is', null);
          
        if (deleteError) {
          throw deleteError;
        }
      }

      // Re-fetch from database to verify and update UI
      await fetchLogs();
    } catch (err: any) {
      console.error('Failed to clear all logs:', err);
      alert(`Failed to clear logs from database: ${err?.message || 'Permission denied or database error.'}`);
      setLoading(false);
    }
  };

  const deleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this log entry permanently from the database?')) return;
    
    setLoading(true);
    try {
      // 1. Try secure RPC first
      const { error: rpcError } = await configuredClient().rpc('delete_sos_event', { p_event_id: id });

      if (rpcError) {
        console.warn('RPC delete_sos_event failed, attempting direct table delete:', rpcError);
        // Fallback: Delete child rows first to satisfy foreign key constraints
        await configuredClient().from('sos_event_updates').delete().eq('sos_event_id', id);
        await configuredClient().from('sos_event_deliveries').delete().eq('sos_event_id', id);
        await configuredClient().from('sos_live_locations').delete().eq('sos_event_id', id);
        await configuredClient().from('sos_location_history').delete().eq('sos_event_id', id);

        const { error: deleteError } = await configuredClient()
          .from('sos_events')
          .delete()
          .eq('id', id);
          
        if (deleteError) {
          throw deleteError;
        }
      }

      // Re-fetch from database to ensure UI matches database exactly
      await fetchLogs();
    } catch (err: any) {
      console.error('Failed to delete log:', err);
      alert(`Failed to delete log from database: ${err?.message || 'Permission denied or database error.'}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    const client = configuredClient();
    const channel = client
      .channel('admin-sos-logs-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_events' },
        () => {
          fetchLogs();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_event_deliveries' },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      log.userName.toLowerCase().includes(q) ||
      log.id.toLowerCase().includes(q) ||
      (log.acceptedRakshak?.name && log.acceptedRakshak.name.toLowerCase().includes(q)) ||
      (log.acceptedRakshak?.area && log.acceptedRakshak.area.toLowerCase().includes(q));

    let matchesStatus = true;
    if (statusFilter === 'accepted') {
      matchesStatus = Boolean(log.acceptedRakshak);
    } else if (statusFilter !== 'all') {
      matchesStatus = log.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-card">
      <div className="admin-card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3>SOS Audit Logs</h3>
          <button type="button" onClick={fetchLogs} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} title="Refresh logs">
            <RefreshCw size={14} color="#64748b" className={loading ? 'spinning' : ''} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {logs.length > 0 && (
            <button 
              type="button"
              onClick={clearAllLogs}
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px',
                color: '#ef4444', fontSize: '12px', fontWeight: 600
              }}>
              Clear All
            </button>
          )}
          <span className="admin-live">Live Database</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, Rakshak, area, or ID..."
            style={{ width: '100%', paddingLeft: '32px', height: '36px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ height: '36px', padding: '0 8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="safe">Safe</option>
          <option value="cancelled">Cancelled</option>
          <option value="accepted">Accepted by Rakshak</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: log.acceptedRakshak ? '1px solid #86efac' : '1px solid #e2e8f0',
              background: log.flagged ? '#fffbe6' : log.acceptedRakshak ? '#fafffd' : '#ffffff',
              position: 'relative'
            }}
          >
            <button 
              onClick={(e) => deleteLog(log.id, e)}
              title="Delete log"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#cbd5e1',
                padding: '4px',
                display: 'flex'
              }}>
              <Trash2 size={16} />
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '28px' }}>
              <b style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {log.userName}
                {log.flagged && (
                  <span style={{ color: '#b45309', fontSize: '10px', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                    <AlertTriangle size={10} /> Rate Soft-Flagged (&gt;3 in 15m)
                  </span>
                )}
              </b>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: log.status === 'active' ? '#ef4444' : log.status === 'safe' ? '#22c55e' : '#64748b',
                }}
              >
                {log.status}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: '#64748b', marginTop: '6px', paddingRight: '28px' }}>
              <span><Clock size={12} /> {log.startedAt} ({log.duration})</span>
              <span><MapPin size={12} /> Source: {log.locationSource}</span>
              <span>Total Deliveries: {log.deliveriesCount}</span>
            </div>

            {/* Rakshak Acceptance Status */}
            {log.acceptedRakshak ? (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 10px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534' }}>
                  <ShieldCheck size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                  <span>
                    Accepted by Rakshak: <strong style={{ color: '#14532d' }}>{log.acceptedRakshak.name}</strong>
                    {log.acceptedRakshak.area ? (
                      <span style={{ color: '#4b5563', marginLeft: '4px' }}>• {log.acceptedRakshak.area}</span>
                    ) : null}
                  </span>
                </div>
                {log.acceptedRakshak.time && (
                  <span style={{ fontSize: '10px', color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Accepted at {log.acceptedRakshak.time}
                  </span>
                )}
              </div>
            ) : log.dispatchedRakshaksCount > 0 ? (
              <div
                style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#64748b'
                }}
              >
                <ShieldAlert size={14} color="#94a3b8" />
                <span>Alerted {log.dispatchedRakshaksCount} nearby Rakshak{log.dispatchedRakshaksCount > 1 ? 's' : ''} (Awaiting Acceptance)</span>
              </div>
            ) : null}
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '16px 0' }}>
            No matching SOS event logs found.
          </p>
        )}
      </div>
    </div>
  );
};
