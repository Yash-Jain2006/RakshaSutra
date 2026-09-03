import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, MapPin, Search, RefreshCw } from 'lucide-react';
import { configuredClient } from '../../services/safetyService';

interface SosLogItem {
  id: string;
  userName: string;
  startedAt: string;
  status: 'active' | 'safe' | 'cancelled';
  locationSource: string;
  deliveriesCount: number;
  duration: string;
  flagged?: boolean;
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
      .select('id, status, location_source, started_at, safe_at, cancelled_at, ended_at, profiles(display_name), sos_event_deliveries(count)')
      .order('started_at', { ascending: false })
      .limit(50);
      
    if (data && !error) {
      const mappedLogs = data.map((e: any) => {
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

        return {
          id: e.id,
          userName: e.profiles?.display_name || 'Unknown User',
          startedAt: dateStr,
          status: e.status,
          locationSource: e.location_source,
          deliveriesCount: e.sos_event_deliveries?.[0]?.count || 0,
          duration: duration,
          flagged: false, // Flagging logic could be added based on recent volume
        };
      });
      setLogs(mappedLogs);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.userName.toLowerCase().includes(search.toLowerCase()) || log.id.includes(search);
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-card">
      <div className="admin-card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3>SOS Audit Logs</h3>
          <button onClick={fetchLogs} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <RefreshCw size={14} color="#64748b" className={loading ? 'spinning' : ''} />
          </button>
        </div>
        <span className="admin-live">Live Database</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user or event ID..."
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
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: log.flagged ? '#fffbe6' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              <span><Clock size={12} /> {log.startedAt} ({log.duration})</span>
              <span><MapPin size={12} /> Source: {log.locationSource}</span>
              <span>Deliveries: {log.deliveriesCount}</span>
            </div>
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
