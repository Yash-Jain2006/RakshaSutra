import React, { useState } from 'react';
import { Check, ShieldCheck, UserCheck, X } from 'lucide-react';

export interface RakshakAppItem {
  id: string;
  name: string;
  docType: string;
  area: string;
  status: 'pending' | 'verified' | 'rejected' | 'inactive' | 'closed';
  submittedAt: string;
}



interface ManageRakshaksProps {
  notify: (msg: string) => void;
}

import { configuredClient } from '../../services/safetyService';

export const ManageRakshaks: React.FC<ManageRakshaksProps> = ({ notify }) => {
  const [apps, setApps] = useState<RakshakAppItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | 'inactive' | 'closed'>('pending');

  const filteredApps = apps.filter((a) => a.status === filter);

  const fetchApps = async () => {
    const { data, error } = await configuredClient()
      .from('rakshak_applications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (data && !error) {
      setApps(
        data.map((row: any) => ({
          id: row.id,
          name: row.full_name_as_id,
          docType: row.document_type,
          area: row.coverage_area,
          status: row.status,
          submittedAt: new Date(row.submitted_at).toLocaleString(),
        }))
      );
    }
  };

  React.useEffect(() => {
    fetchApps();
  }, []);

  const handleApprove = async (id: string) => {
    const { error } = await configuredClient().rpc('approve_rakshak_application', { app_id: id });
    if (error) {
      notify('Failed to approve application.');
    } else {
      notify('Rakshak application verified & approved. Audit logged.');
      fetchApps();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await configuredClient().rpc('reject_rakshak_application', { app_id: id });
    if (error) {
      notify('Failed to reject application.');
    } else {
      notify('Rakshak application rejected. Audit logged.');
      fetchApps();
    }
  };

  const handleSuspend = async (id: string) => {
    const { error } = await configuredClient().rpc('suspend_rakshak', { app_id: id });
    if (error) {
      notify('Failed to suspend Rakshak.');
    } else {
      notify('Rakshak suspended successfully.');
      fetchApps();
    }
  };

  const handleClose = async (id: string) => {
    const { error } = await configuredClient().rpc('close_rakshak', { app_id: id });
    if (error) {
      notify('Failed to close Rakshak account.');
    } else {
      notify('Rakshak account closed successfully.');
      fetchApps();
    }
  };

  const handleActivate = async (id: string) => {
    const { error } = await configuredClient().rpc('activate_rakshak', { app_id: id });
    if (error) {
      notify('Failed to activate Rakshak.');
    } else {
      notify('Rakshak activated successfully.');
      fetchApps();
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">
        <h3>Manage Rakshaks (Phase 1)</h3>
        <span className="admin-pending">
          {apps.filter((a) => a.status === 'pending').length} Pending Review
        </span>
      </div>

      {/* Tabs */}
      <div className="admin-sub-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        {(['pending', 'verified', 'inactive', 'closed', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            className={filter === tab ? 'active' : ''}
            onClick={() => setFilter(tab)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: filter === tab ? '1px solid #6c63f2' : '1px solid #e2e8f0',
              background: filter === tab ? '#6c63f2' : '#f8fafc',
              color: filter === tab ? '#fff' : '#475569',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredApps.map((item) => (
          <div
            key={item.id}
            className="moderate-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '12px',
            }}
          >
            <div style={{ flex: 1, paddingRight: '12px' }}>
              <b style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {item.name}
                {item.status === 'verified' && <ShieldCheck size={14} color="#22c55e" />}
              </b>
              <div style={{ color: '#64748b', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>Doc: {item.docType}</span>
                <span>Area: {item.area}</span>
                <span>Submitted: {item.submittedAt}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {item.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleApprove(item.id)}
                    style={{ padding: '6px 10px', background: '#22c55e', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    className="reject"
                    onClick={() => handleReject(item.id)}
                    style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}
                  >
                    <X size={14} /> Reject
                  </button>
                </>
              )}
              {item.status === 'verified' && (
                <>
                  <button
                    onClick={() => handleSuspend(item.id)}
                    style={{ padding: '6px 10px', background: '#f59e0b', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => handleClose(item.id)}
                    style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}
                  >
                    Close
                  </button>
                </>
              )}
              {item.status === 'inactive' && (
                <button
                  onClick={() => handleActivate(item.id)}
                  style={{ padding: '6px 10px', background: '#22c55e', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}
                >
                  <Check size={14} /> Activate
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredApps.length === 0 && (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '16px 0' }}>
            No {filter} Rakshak applications.
          </p>
        )}
      </div>
    </div>
  );
};
