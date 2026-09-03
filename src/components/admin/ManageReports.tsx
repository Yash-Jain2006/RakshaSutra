import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { configuredClient } from '../../services/safetyService';

interface ManageReportsProps {
  notify: (msg: string) => void;
}

export const ManageReports: React.FC<ManageReportsProps> = ({ notify }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await configuredClient()
      .from('incident_reports')
      .select('*, profiles(display_name)')
      .order('created_at', { ascending: false });
      
    if (data && !error) {
      setReports(data);
    } else if (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await configuredClient()
      .from('incident_reports')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (error) {
      notify('Failed to update report status.');
    } else {
      notify(`Report marked as ${newStatus}.`);
      fetchReports();
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3>Community Incident Reports</h3>
          <button onClick={fetchReports} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <RefreshCw size={14} color="#64748b" className={loading ? 'spinning' : ''} />
          </button>
        </div>
        <span className="admin-live">Live Database</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        {reports.map((report) => (
          <div
            key={report.id}
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <b style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} />
                  {report.place}
                </b>
                <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 8px 0' }}>
                  {report.description}
                </p>
                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '12px' }}>
                  <span style={{ color: report.rating === 'Unsafe' ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    {report.rating}
                  </span>
                  <span>By: {report.anonymous ? 'Anonymous' : (report.profiles?.display_name || 'Unknown')}</span>
                  <span>{new Date(report.created_at).toLocaleString()}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: report.status === 'pending' ? '#d97706' : report.status === 'reviewed' ? '#22c55e' : '#ef4444',
                    background: report.status === 'pending' ? '#fef3c7' : report.status === 'reviewed' ? '#dcfce7' : '#fee2e2',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {report.status}
                </span>
                
                {report.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => updateStatus(report.id, 'reviewed')}
                      style={{ background: '#22c55e', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle size={12} /> Verify
                    </button>
                    <button 
                      onClick={() => updateStatus(report.id, 'rejected')}
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {reports.length === 0 && !loading && (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '16px 0' }}>
            No incident reports found.
          </p>
        )}
      </div>
    </div>
  );
};
