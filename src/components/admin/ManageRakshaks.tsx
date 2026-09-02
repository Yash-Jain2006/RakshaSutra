import React, { useState } from 'react';
import { Check, ShieldCheck, UserCheck, X } from 'lucide-react';

export interface RakshakAppItem {
  id: string;
  name: string;
  docType: string;
  area: string;
  status: 'pending' | 'verified' | 'rejected' | 'inactive';
  submittedAt: string;
}

const initialApps: RakshakAppItem[] = [
  { id: '1', name: 'Arjun Rao', docType: 'Aadhaar', area: 'HSR Layout, Bengaluru', status: 'pending', submittedAt: 'Today, 2:15 PM' },
  { id: '2', name: 'Kavya Nair', docType: 'Driving Licence', area: 'Indiranagar', status: 'pending', submittedAt: 'Yesterday' },
  { id: '3', name: 'Priya Kulkarni', docType: 'Aadhaar', area: 'Koramangala', status: 'verified', submittedAt: '3 days ago' },
];

interface ManageRakshaksProps {
  notify: (msg: string) => void;
}

export const ManageRakshaks: React.FC<ManageRakshaksProps> = ({ notify }) => {
  const [apps, setApps] = useState<RakshakAppItem[]>(initialApps);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected'>('pending');

  const filteredApps = apps.filter((a) => a.status === filter);

  const handleApprove = (id: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'verified' } : a))
    );
    notify('Rakshak application verified & approved. Audit logged.');
  };

  const handleReject = (id: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a))
    );
    notify('Rakshak application rejected. Audit logged.');
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
      <div className="admin-sub-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {(['pending', 'verified', 'rejected'] as const).map((tab) => (
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
            <div>
              <b style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {item.name}
                {item.status === 'verified' && <ShieldCheck size={14} color="#22c55e" />}
              </b>
              <small style={{ color: '#64748b', fontSize: '11px' }}>
                Doc: {item.docType} · Area: {item.area} · Submitted: {item.submittedAt}
              </small>
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
                <button
                  onClick={() => handleReject(item.id)}
                  style={{ padding: '6px 10px', background: '#f59e0b', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}
                >
                  Deactivate
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
