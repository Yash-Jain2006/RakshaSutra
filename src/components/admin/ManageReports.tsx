import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, RefreshCw, CheckCircle, XCircle, Eye, X } from 'lucide-react';
import { configuredClient } from '../../services/safetyService';

interface ManageReportsProps {
  notify: (msg: string) => void;
}

export const ManageReports: React.FC<ManageReportsProps> = ({ notify }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [modalPhoto, setModalPhoto] = useState<string | null>(null);

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
    // Update both possible status columns for resilience
    const updatePayload: Record<string, string> = {
      moderation_status: newStatus,  // original DB column
      status: newStatus,             // new column
    };

    const { error } = await configuredClient()
      .from('incident_reports')
      .update(updatePayload)
      .eq('id', id);
      
    if (error) {
      console.error('Update status error:', error);
      notify('Failed to update report status: ' + error.message);
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
        {reports.map((report) => {
          let descText = report.description || '';
          let photo = report.photo_url || null;
          if (!photo && descText.includes('[Attached Photo]:')) {
            const parts = descText.split('[Attached Photo]:');
            descText = parts[0].trim();
            photo = parts[1]?.trim() || null;
          }

          const statusRaw = (report.moderation_status || report.status || 'pending').toLowerCase();
          const isPending = statusRaw === 'pending';
          const isReviewed = statusRaw === 'reviewed' || statusRaw === 'approved';
          const isAnon = Boolean(report.anonymous || report.is_anonymous);
          const authorName = isAnon ? 'Anonymous' : (report.profiles?.display_name || 'Community Member');
          const isUnsafe = (report.rating || report.sentiment) === 'Unsafe' || (report.sentiment === 'unsafe');

          return (
            <div
              key={report.id}
              style={{
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Header row: Location on left, Status badge on right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                <b style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                  <MapPin size={15} style={{ flexShrink: 0, color: '#6366f1' }} />
                  {report.place || report.place_label || 'Unknown location'}
                </b>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: isPending ? '#b45309' : isReviewed ? '#15803d' : '#b91c1c',
                    background: isPending ? '#fef3c7' : isReviewed ? '#dcfce7' : '#fee2e2',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {statusRaw}
                </span>
              </div>

              {/* Description row with View Docs button on right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: 1.45, wordBreak: 'break-word', flex: 1 }}>
                  {descText}
                </p>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc(viewingDoc === report.id ? null : report.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      background: viewingDoc === report.id ? '#ede9fe' : '#f8fafc',
                      color: '#6255ec',
                      borderRadius: '7px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: '1px solid #c4b5fd',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <Eye size={12} />
                    {viewingDoc === report.id ? 'Hide Docs' : 'View Docs'}
                  </button>
                )}
              </div>

              {/* Photo document - ONLY shown when View Docs is toggled */}
              {photo && viewingDoc === report.id && (
                <div style={{ marginBottom: '10px' }}>
                  <img
                    src={photo}
                    alt="Report document"
                    onClick={() => setModalPhoto(photo)}
                    style={{
                      width: '100%',
                      maxHeight: '220px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #c4b5fd',
                      display: 'block',
                      cursor: 'pointer',
                    }}
                  />
                  <small style={{ color: '#64748b', fontSize: '10.5px', display: 'block', marginTop: '4px', textAlign: 'right' }}>
                    Tap image to view fullscreen
                  </small>
                </div>
              )}

              {/* Metadata row */}
              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: isUnsafe ? '#dc2626' : '#16a34a', fontWeight: 700, background: isUnsafe ? '#fee2e2' : '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                  {report.rating || (isUnsafe ? 'Unsafe' : 'Safe')}
                </span>
                <span>By: <strong style={{ color: '#1e293b' }}>{authorName}</strong></span>
                <span style={{ color: '#94a3b8' }}>{new Date(report.created_at).toLocaleString()}</span>
              </div>

              {/* Bottom full-width action bar when pending */}
              {isPending && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    onClick={() => updateStatus(report.id, 'approved')}
                    style={{
                      flex: 1,
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle size={14} /> Verify
                  </button>
                  <button
                    onClick={() => updateStatus(report.id, 'rejected')}
                    style={{
                      flex: 1,
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {reports.length === 0 && !loading && (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '16px 0' }}>
            No incident reports found.
          </p>
        )}
      </div>

      {/* Fullscreen Photo Lightbox Modal */}
      {modalPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setModalPhoto(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '96vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalPhoto(null)}
              style={{
                position: 'absolute',
                top: '-38px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Close photo"
            >
              <X size={18} />
            </button>
            <img
              src={modalPhoto}
              alt="Report document enlarged"
              style={{
                maxWidth: '96vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
