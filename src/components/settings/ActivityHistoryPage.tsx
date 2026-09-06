import React, { useEffect, useState } from 'react';
import { RefreshCw, Navigation, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { configuredClient } from '../../services/safetyService';
import { BackHeader } from '../layout/BackHeader';

interface ActivityHistoryPageProps {
  nav: (page: string) => void;
  userId?: string;
}

interface ActivityLog {
  id: string;
  type: 'SOS' | 'Journey';
  status: string;
  date: string;
  duration: string;
  deliveries: number;
}

export const ActivityHistoryPage: React.FC<ActivityHistoryPageProps> = ({ nav, userId }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const { data, error } = await configuredClient()
      .from('sos_events')
      .select('id, status, started_at, safe_at, cancelled_at, ended_at, sos_event_deliveries(count)')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(50);
      
    if (data && !error) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const validData = data.filter((e: any) => new Date(e.started_at) >= ninetyDaysAgo);

      const mappedLogs = validData.map((e: any) => {
        const start = new Date(e.started_at).getTime();
        const endTimeStr = e.safe_at || e.cancelled_at || e.ended_at;
        const end = endTimeStr ? new Date(endTimeStr).getTime() : Date.now();
        const diffSecs = Math.floor((end - start) / 1000);
        const mins = Math.floor(diffSecs / 60);
        const secs = diffSecs % 60;
        const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        const d = new Date(e.started_at);
        const dateStr = d.toLocaleDateString() === new Date().toLocaleDateString() 
          ? `Today, ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
          : d.toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'});

        return {
          id: e.id,
          type: 'SOS' as const,
          status: e.status,
          date: dateStr,
          duration: duration,
          deliveries: e.sos_event_deliveries?.[0]?.count || 0,
        };
      });
      const hiddenStr = localStorage.getItem(`hiddenLogs_${userId}`) || '[]';
      const hiddenLogs = new Set<string>(JSON.parse(hiddenStr));
      const visibleLogs = mappedLogs.filter((log: any) => !hiddenLogs.has(log.id));
      
      setLogs(visibleLogs);
    }
    setLoading(false);
  };

  const clearAllLogs = async () => {
    if (!userId) return;
    if (!window.confirm('Are you sure you want to clear all activity history? This cannot be undone.')) return;
    
    const hiddenStr = localStorage.getItem(`hiddenLogs_${userId}`) || '[]';
    const hiddenLogs = new Set<string>(JSON.parse(hiddenStr));
    logs.forEach(log => hiddenLogs.add(log.id));
    localStorage.setItem(`hiddenLogs_${userId}`, JSON.stringify(Array.from(hiddenLogs)));
    
    setLogs([]);
  };

  const deleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this log entry?')) return;
    
    const hiddenStr = localStorage.getItem(`hiddenLogs_${userId}`) || '[]';
    const hiddenLogs = new Set<string>(JSON.parse(hiddenStr));
    hiddenLogs.add(id);
    localStorage.setItem(`hiddenLogs_${userId}`, JSON.stringify(Array.from(hiddenLogs)));
    
    setLogs(prev => prev.filter(log => log.id !== id));
  };

  useEffect(() => {
    fetchLogs();
  }, [userId]);

  return (
    <section className="screen settings-screen" style={{ background: 'var(--bg-primary)' }}>
      <BackHeader title="Activity History" nav={nav} />
      
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Recent Activity</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {logs.length > 0 && (
              <button 
                onClick={clearAllLogs}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  color: '#ef4444', fontSize: '12px', fontWeight: 600
                }}>
                Clear All
              </button>
            )}
            <button onClick={fetchLogs} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <RefreshCw size={14} color="var(--text-dim)" className={loading ? 'spinning' : ''} />
            </button>
          </div>
        </div>

        {loading && logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: '13px' }}>
            Loading activity...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
            <p>No recent activity found.</p>
            <p style={{ marginTop: '8px', fontSize: '11px' }}>SOS events and journey logs will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map(log => (
              <div key={log.id} style={{ 
                background: 'var(--bg-card)', 
                borderRadius: '12px', 
                padding: '16px',
                border: '1px solid var(--border-subtle)',
                position: 'relative'
              }}>
                <button 
                  onClick={(e) => deleteLog(log.id, e)}
                  title="Delete log"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '16px',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#cbd5e1',
                    padding: '8px',
                    display: 'flex'
                  }}>
                  <Trash2 size={16} />
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', paddingRight: '36px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {log.type === 'SOS' ? (
                      <AlertTriangle size={16} color={log.status === 'active' ? '#ef4444' : '#f59e0b'} />
                    ) : (
                      <Navigation size={16} color="#3b82f6" />
                    )}
                    <b style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{log.type} {log.type === 'SOS' ? 'Alert' : 'Session'}</b>
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: log.status === 'active' ? '#fee2e2' : log.status === 'safe' ? '#dcfce7' : '#f1f5f9',
                    color: log.status === 'active' ? '#ef4444' : log.status === 'safe' ? '#22c55e' : '#64748b',
                    textTransform: 'uppercase'
                  }}>
                    {log.status}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', paddingRight: '36px' }}>
                  <span>{log.date}</span>
                  <span>Duration: {log.duration}</span>
                </div>
                
                {log.deliveries > 0 && (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} color="#22c55e" />
                    Alerted {log.deliveries} contacts
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
