import React, { useState } from 'react';
import { AlertTriangle, FileText, MapPin, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import type { IncidentReport } from '../../types/models';
import { BackHeader } from '../layout/BackHeader';
import { ManageRakshaks } from './ManageRakshaks';
import { ManageSosLogs } from './ManageSosLogs';

interface AdminPanelProps {
  nav: (page: string) => void;
  reports: IncidentReport[];
  notify: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ nav, reports, notify }) => {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Rakshaks' | 'SOS Logs' | 'Phase2Stub'>('Overview');
  const [stubTitle, setStubTitle] = useState('');

  const menu = [
    'Overview',
    'Rakshaks',
    'SOS Logs',
    'Zones (P2)',
    'Safe Places (P2)',
    'Reports (P2)',
    'Users (P2)',
    'Supports (P2)',
  ];

  const handleTabClick = (item: string) => {
    if (item === 'Overview' || item === 'Rakshaks' || item === 'SOS Logs') {
      setActiveTab(item);
    } else {
      setStubTitle(item);
      setActiveTab('Phase2Stub');
    }
  };

  return (
    <section className="screen admin-screen">
      <BackHeader
        title="Admin Panel"
        nav={nav}
        extra={<span className="admin-live">Server Role Enforced</span>}
      />

      <div className="admin-tabs">
        {menu.map((item) => {
          const isActive =
            (activeTab === 'Overview' && item === 'Overview') ||
            (activeTab === 'Rakshaks' && item === 'Rakshaks') ||
            (activeTab === 'SOS Logs' && item === 'SOS Logs') ||
            (activeTab === 'Phase2Stub' && item === stubTitle);

          return (
            <button
              className={isActive ? 'active' : ''}
              key={item}
              onClick={() => handleTabClick(item)}
            >
              {item}
            </button>
          );
        })}
      </div>

      {activeTab === 'Overview' && (
        <>
          <div className="admin-welcome">
            <p>Good evening, Admin</p>
            <h2>Safety Network Overview</h2>
          </div>

          <div className="metric-grid">
            <article className="metric red">
              <span><AlertTriangle size={19} /></span>
              <b>12</b>
              <small>SOS alerts today</small>
            </article>
            <article className="metric purple">
              <span><ShieldCheck size={19} /></span>
              <b>86</b>
              <small>Active Rakshaks</small>
            </article>
            <article className="metric orange">
              <span><FileText size={19} /></span>
              <b>{reports.length + 2}</b>
              <small>Pending reports</small>
            </article>
            <article className="metric green">
              <span><MapPin size={19} /></span>
              <b>29</b>
              <small>Safe places</small>
            </article>
          </div>

          <div className="admin-card">
            <div className="admin-card-title">
              <h3>Phase 1 Action Queue</h3>
            </div>
            <button className="setting-row" onClick={() => setActiveTab('Rakshaks')} style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', padding: '10px 0' }}>
              <UserRound size={18} />
              <b style={{ flex: 1, marginLeft: '8px' }}>Manage Rakshak Applications</b>
              <small style={{ color: '#6c63f2', fontWeight: 700 }}>Review Queue →</small>
            </button>
            <button className="setting-row" onClick={() => setActiveTab('SOS Logs')} style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', padding: '10px 0' }}>
              <AlertTriangle size={18} />
              <b style={{ flex: 1, marginLeft: '8px' }}>Manage SOS Audit Logs</b>
              <small style={{ color: '#6c63f2', fontWeight: 700 }}>View Logs →</small>
            </button>
          </div>
        </>
      )}

      {activeTab === 'Rakshaks' && <ManageRakshaks notify={notify} />}
      {activeTab === 'SOS Logs' && <ManageSosLogs />}

      {activeTab === 'Phase2Stub' && (
        <div className="admin-card coming-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <SlidersHorizontal size={36} color="#6c63f2" style={{ margin: '0 auto 12px' }} />
          <h3>{stubTitle}</h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 16px' }}>
            This feature is scoped to <b>Phase 2</b> per project requirements. The Phase 1 admin interface is strictly limited to Manage Rakshaks and SOS Logs.
          </p>
          <button className="secondary" onClick={() => setActiveTab('Overview')}>
            Return to Overview
          </button>
        </div>
      )}
    </section>
  );
};
