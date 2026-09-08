import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, ChevronRight, Eye, FileText, HeartHandshake, MapPin, Plus, ShieldCheck, XCircle } from 'lucide-react';
import type { IncidentReport } from '../../types/models';
import { BackHeader } from '../layout/BackHeader';
import { CommunityGuidelines, ReportComposer } from './CommunityGuidelines';
import { configuredClient } from '../../services/safetyService';
import { getCurrentSession } from '../../services/authService';

interface CommunityPageProps {
  nav: (page: string) => void;
}

export const CommunityPage: React.FC<CommunityPageProps> = ({ nav }) => {
  const [composer, setComposer] = useState(false);
  const [guidelines, setGuidelines] = useState(false);
  const [feedReports, setFeedReports] = useState<any[]>([]);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'my'>('feed');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [modalPhoto, setModalPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchReports = async () => {
    try {
      const session = await getCurrentSession();
      const uid = session?.user?.id || null;
      setCurrentUserId(uid);

      const { data, error } = await configuredClient()
        .from('incident_reports')
        .select('*, profiles(display_name)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch reports error:', error);
        return;
      }

      if (data) {
        const mapped = data.map((r: any) => {
          // Support photo embedded in description (legacy fallback)
          let text = r.description || '';
          let photoUrl = r.photo_url || null;
          if (!photoUrl && text.includes('[Attached Photo]:')) {
            const parts = text.split('[Attached Photo]:');
            text = parts[0].trim();
            photoUrl = parts[1]?.trim() || null;
          }

          let normalizedStatus: 'approved' | 'pending' | 'rejected' = 'pending';
          if (
            r.status === 'reviewed' ||
            r.status === 'approved' ||
            r.moderation_status === 'approved' ||
            r.moderation_status === 'reviewed'
          ) {
            normalizedStatus = 'approved';
          } else if (r.status === 'rejected' || r.moderation_status === 'rejected') {
            normalizedStatus = 'rejected';
          }

          return {
            id: r.id,
            user_id: r.user_id,
            place: r.place || r.place_label || 'Unknown location',
            text,
            rating: r.rating || (r.sentiment === 'safe' ? 'Safe' : 'Unsafe'),
            anonymous: r.anonymous ?? r.is_anonymous ?? false,
            time: new Date(r.created_at).toLocaleDateString(),
            created_at: r.created_at,
            status: normalizedStatus,
            photo_url: photoUrl,
            userName: r.profiles?.display_name || 'Anonymous member',
          };
        });

        // Community Feed: Approved / reviewed reports
        setFeedReports(mapped.filter((r: any) => r.status === 'approved'));

        // My Reports: All reports submitted by current user (pending, approved, rejected)
        if (uid) {
          setMyReports(mapped.filter((r: any) => r.user_id === uid));
        } else {
          setMyReports([]);
        }
      }
    } catch (err) {
      console.error('fetchReports exception:', err);
    }
  };

  React.useEffect(() => {
    fetchReports();
  }, []);

  const submitReport = async (report: Partial<IncidentReport>) => {
    setSubmitError('');
    setSubmitting(true);

    try {
      const session = await getCurrentSession();
      if (!session?.user) {
        setSubmitError('You must be signed in to submit a report.');
        return;
      }

      // Compress photo to a data URL if provided
      let photo_url: string | null = null;
      if (report.photo) {
        try {
          photo_url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to read image.'));
            reader.onload = (e) => {
              const img = new window.Image();
              img.onerror = () => reject(new Error('Invalid image format.'));
              img.onload = () => {
                let { width, height } = img;
                const MAX = 800;
                if (width > MAX || height > MAX) {
                  if (width > height) {
                    height = Math.round((height * MAX) / width);
                    width = MAX;
                  } else {
                    width = Math.round((width * MAX) / height);
                    height = MAX;
                  }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
              };
              img.src = e.target?.result as string;
            };
            reader.readAsDataURL(report.photo!);
          });
        } catch (imgErr) {
          console.warn('Photo compression failed, skipping photo:', imgErr);
        }
      }

      const place = report.place?.trim() || 'Unknown';
      let text = report.text?.trim() || '';
      const rating = report.rating || 'Unsafe';
      const anonymous = Boolean(report.anonymous);

      if (text.length < 10) {
        setSubmitError(`Please describe the situation with at least 10 characters (currently ${text.length}).`);
        setSubmitting(false);
        return;
      }
      if (text.length > 2500) {
        text = text.slice(0, 2500);
      }

      // Sync real display name from auth metadata to profiles table so reports show real name, not email address
      const realName =
        session.user.user_metadata?.display_name ||
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name;
      if (realName && realName.trim()) {
        try {
          await configuredClient()
            .from('profiles')
            .update({ display_name: realName.trim() })
            .eq('id', session.user.id);
        } catch (syncErr) {
          console.warn('Profile sync notice:', syncErr);
        }
      }

      // PRIMARY insert: complies with DB schema constraints:
      // description must be 10-2500 chars (photo is NOT appended here)
      // photo_url stores the attached photo data/URL directly
      const primaryPayload: Record<string, any> = {
        user_id: session.user.id,
        place_label: place,
        place: place,
        description: text,
        sentiment: rating.toLowerCase(),
        rating: rating,
        is_anonymous: anonymous,
        anonymous: anonymous,
        moderation_status: 'pending',
        status: 'pending',
        latitude: 0,
        longitude: 0,
        photo_url: photo_url || null,
      };

      const { data: insertedRows, error } = await configuredClient()
        .from('incident_reports')
        .insert(primaryPayload)
        .select('id');

      if (error) {
        console.error('Insert error:', error);
        setSubmitError(error.message || 'Failed to submit. Please try again.');
        return;
      }

      // Also record in incident_media if photo was attached and media table is active
      const insertedReportId = insertedRows?.[0]?.id;
      if (photo_url && insertedReportId) {
        try {
          await configuredClient().from('incident_media').insert({
            report_id: insertedReportId,
            storage_path: `incident-media-${insertedReportId}-${Date.now()}`,
            mime_type: 'image/jpeg',
          });
        } catch (mediaErr) {
          console.warn('Optional incident_media sync:', mediaErr);
        }
      }

      // Success! Fetch updated reports and switch to My Reports tab so user sees their submission status
      await fetchReports();
      setActiveTab('my');
      setComposer(false);
      setSubmitError('');
    } catch (err: any) {
      console.error('Submit exception:', err);
      setSubmitError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayReports = activeTab === 'feed' ? feedReports : myReports;

  return (
    <section className="screen community-screen">
      <BackHeader
        title="Community"
        nav={nav}
        extra={
          <button className="round-add" onClick={() => setComposer(true)} aria-label="Add report">
            <Plus size={20} />
          </button>
        }
      />
      <div className="community-hero">
        <span>
          <HeartHandshake size={26} />
        </span>
        <div>
          <b>Safer, together.</b>
          <p>Share what you see to help your community stay informed.</p>
        </div>
      </div>

      <button className="guidelines-link" onClick={() => setGuidelines(true)}>
        <FileText size={16} /> Community reporting guidelines <ChevronRight size={16} />
      </button>

      {/* Tab Selector: Community Feed vs My Reports */}
      <div style={{ display: 'flex', gap: '8px', margin: '14px 0 10px', background: 'var(--bg-elevated, #f1f5f9)', padding: '4px', borderRadius: '10px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: '7px',
            fontSize: '12px',
            fontWeight: activeTab === 'feed' ? 700 : 500,
            background: activeTab === 'feed' ? 'var(--bg-surface, #ffffff)' : 'transparent',
            color: activeTab === 'feed' ? 'var(--text-main, #1e293b)' : 'var(--text-dim, #64748b)',
            boxShadow: activeTab === 'feed' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Community Feed
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: '7px',
            fontSize: '12px',
            fontWeight: activeTab === 'my' ? 700 : 500,
            background: activeTab === 'my' ? 'var(--bg-surface, #ffffff)' : 'transparent',
            color: activeTab === 'my' ? 'var(--text-main, #1e293b)' : 'var(--text-dim, #64748b)',
            boxShadow: activeTab === 'my' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>My Reports</span>
          {myReports.length > 0 && (
            <span
              style={{
                background: activeTab === 'my' ? '#6255ec' : '#94a3b8',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px',
              }}
            >
              {myReports.length}
            </span>
          )}
        </button>
      </div>

      <div className="report-feed">
        {displayReports.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '36px 16px', fontSize: '13px' }}>
            {activeTab === 'feed' ? (
              <p>No verified community reports yet. Tap '+' to share an update!</p>
            ) : (
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-main, #1e293b)', marginBottom: '4px' }}>No reports submitted yet</p>
                <p style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)' }}>
                  When you report an unsafe zone or hazard, you can track its review status right here.
                </p>
              </div>
            )}
          </div>
        )}

        {displayReports.map((report) => (
          <article className="report-card" key={report.id}>
            <div className="report-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span className={`report-badge ${report.rating?.toLowerCase()}`}>
                  {report.rating === 'Safe' ? (
                    <ShieldCheck size={15} />
                  ) : (
                    <AlertTriangle size={15} />
                  )}{' '}
                  {report.rating}
                </span>

                {/* Moderation Status badge shown in My Reports tab */}
                {activeTab === 'my' && (
                  <>
                    {report.status === 'approved' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 7px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={11} /> Approved & Live
                      </span>
                    )}
                    {report.status === 'pending' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 7px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> Pending Review
                      </span>
                    )}
                    {report.status === 'rejected' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 7px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <XCircle size={11} /> Rejected
                      </span>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {report.photo_url && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc(viewingDoc === report.id ? null : report.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      background: viewingDoc === report.id ? '#ede9fe' : 'rgba(98, 85, 236, 0.08)',
                      color: '#6255ec',
                      borderRadius: '6px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      border: '1px solid #c4b5fd',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Eye size={12} />
                    {viewingDoc === report.id ? 'Hide Docs' : 'View Docs'}
                  </button>
                )}
                <small>{report.time}</small>
              </div>
            </div>

            <h3>
              <MapPin size={15} />
              {report.place}
            </h3>
            <p>{report.text}</p>

            {/* Photo document - ONLY shown when View Docs is toggled */}
            {report.photo_url && viewingDoc === report.id && (
              <div style={{ marginTop: '10px', marginBottom: '8px' }}>
                <img
                  src={report.photo_url}
                  alt="Report document"
                  onClick={() => setModalPhoto(report.photo_url)}
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

            {/* Status explainer banner when viewing in My Reports */}
            {activeTab === 'my' && report.status === 'pending' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#92400e', marginTop: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Clock size={13} style={{ flexShrink: 0 }} />
                <span>Under review by moderation team. It will appear on the public feed once verified.</span>
              </div>
            )}
            {activeTab === 'my' && report.status === 'rejected' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#991b1b', marginTop: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <XCircle size={13} style={{ flexShrink: 0 }} />
                <span>This report was rejected and is not visible on the community feed.</span>
              </div>
            )}

            <footer>
              <span>{report.anonymous ? 'Anonymous member' : report.userName}</span>
              {activeTab === 'my' && report.anonymous && (
                <span style={{ color: '#64748b', fontStyle: 'italic' }}>(Submitted as Anonymous)</span>
              )}
            </footer>
          </article>
        ))}
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
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '85%' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModalPhoto(null)}
              style={{
                position: 'absolute',
                top: '-36px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#fff',
                fontSize: '18px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
            <img
              src={modalPhoto}
              alt="Report document fullscreen"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: '8px',
                objectFit: 'contain',
                display: 'block',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        </div>
      )}

      {composer && (
        <ReportComposer
          close={() => { setComposer(false); setSubmitError(''); }}
          submit={submitReport}
          submitting={submitting}
          error={submitError}
        />
      )}
      {guidelines && <CommunityGuidelines close={() => setGuidelines(false)} />}
    </section>
  );
};
