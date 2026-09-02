import React, { useState } from 'react';
import { AlertTriangle, Clock, MapPin, Search } from 'lucide-react';

interface SosLogItem {
  id: string;
  userName: string;
  startedAt: string;
  status: 'active' | 'safe' | 'cancelled';
  locationSource: 'precise' | 'last_known' | 'fallback';
  deliveriesCount: number;
  duration: string;
  flagged?: boolean;
}

const mockLogs: SosLogItem[] = [
  { id: 'sos-101', userName: 'Ananya Sharma', startedAt: 'Today, 8:15 PM', status: 'safe', locationSource: 'precise', deliveriesCount: 5, duration: '4m 12s' },
  { id: 'sos-102', userName: 'Pooja Verma', startedAt: 'Today, 6:40 PM', status: 'cancelled', locationSource: 'fallback', deliveriesCount: 3, duration: '1m 05s' },
  { id: 'sos-103', userName: 'User #8492', startedAt: 'Yesterday', status: 'safe', locationSource: 'precise', deliveriesCount: 6, duration: '12m 30s', flagged: true },
];

export const ManageSosLogs: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch = log.userName.toLowerCase().includes(search.toLowerCase()) || log.id.includes(search);
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-card">
      <div className="admin-card-title">
        <h3>SOS Audit Logs (Phase 1)</h3>
        <span className="admin-live">Real-time DB Audited</span>
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
