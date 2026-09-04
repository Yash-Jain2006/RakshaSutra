import React, { useState } from 'react';
import { Check, Eye, EyeOff, ShieldCheck, X, FileText } from 'lucide-react';
import { configuredClient } from '../../services/safetyService';

export interface RakshakAppItem {
  id: string;
  userId?: string;
  name: string;
  docType: string;
  area: string;
  status: 'pending' | 'verified' | 'rejected' | 'inactive' | 'closed';
  submittedAt: string;
  docs?: RakshakDoc[];
}

interface RakshakDoc {
  id: string;
  side: 'front' | 'back';
  storage_path: string;
  mime_type: string;
  signedUrl?: string;
}

interface ManageRakshaksProps {
  notify: (msg: string) => void;
}

export const ManageRakshaks: React.FC<ManageRakshaksProps> = ({ notify }) => {
  const [apps, setApps] = useState<RakshakAppItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | 'inactive' | 'closed'>('pending');
  const [viewingDocs, setViewingDocs] = useState<RakshakAppItem | null>(null);
  const [loadingDocs, setLoadingDocs] = useState<string | null>(null);

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
          userId: row.user_id,
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

  // Fetch signed URLs for documents of an application
  const fetchDocs = async (app: RakshakAppItem) => {
    setLoadingDocs(app.id);
    try {
      // 1. Try fetching recorded documents from DB
      const { data, error } = await configuredClient()
        .from('rakshak_documents')
        .select('id, side, storage_path, mime_type')
        .eq('application_id', app.id);

      if (error) throw error;

      let docRecords = data || [];

      // 2. If DB records were already deleted or empty, check storage folder directly
      if (docRecords.length === 0 && app.userId) {
        const { data: folderFiles } = await configuredClient()
          .storage.from('identity-documents')
          .list(app.userId);

        if (folderFiles && folderFiles.length > 0) {
          docRecords = folderFiles.map((f: any) => ({
            id: f.id || f.name,
            side: f.name.startsWith('back') ? 'back' : 'front',
            storage_path: `${app.userId}/${f.name}`,
            mime_type: f.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          }));
        }
      }

      if (docRecords.length === 0) {
        notify('No documents found for this application (they may already be deleted).');
        setLoadingDocs(null);
        return;
      }

      // Generate signed URLs (valid for 10 minutes)
      const docs: RakshakDoc[] = await Promise.all(
        docRecords.map(async (doc: any) => {
          const { data: urlData } = await configuredClient()
            .storage.from('identity-documents')
            .createSignedUrl(doc.storage_path, 600);
          return {
            id: doc.id,
            side: doc.side,
            storage_path: doc.storage_path,
            mime_type: doc.mime_type,
            signedUrl: urlData?.signedUrl,
          };
        })
      );

      setViewingDocs({ ...app, docs });
    } catch (err: any) {
      notify(`❌ Failed to load docs: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoadingDocs(null);
    }
  };

  // Delete all docs from storage + DB
  const deleteDocsForApp = async (appId: string, userId?: string) => {
    try {
      const pathsToDelete: string[] = [];

      // 1. Find paths recorded in rakshak_documents table
      const { data: docs } = await configuredClient()
        .from('rakshak_documents')
        .select('id, storage_path')
        .eq('application_id', appId);

      if (docs && docs.length > 0) {
        docs.forEach((d: any) => {
          if (d.storage_path && !pathsToDelete.includes(d.storage_path)) {
            pathsToDelete.push(d.storage_path);
          }
        });
      }

      // 2. Also check applicant's folder directly in identity-documents bucket
      if (userId) {
        const { data: folderFiles } = await configuredClient()
          .storage
          .from('identity-documents')
          .list(userId);

        if (folderFiles && folderFiles.length > 0) {
          folderFiles.forEach((f: any) => {
            const p = `${userId}/${f.name}`;
            if (!pathsToDelete.includes(p)) {
              pathsToDelete.push(p);
            }
          });
        }
      }

      // 3. Delete physical files from Supabase Storage
      if (pathsToDelete.length > 0) {
        const { error: removeError } = await configuredClient()
          .storage
          .from('identity-documents')
          .remove(pathsToDelete);

        if (removeError) {
          console.error('Storage removal error:', removeError);
        }
      }

      // 4. Delete rows from rakshak_documents table
      await configuredClient()
        .from('rakshak_documents')
        .delete()
        .eq('application_id', appId);
    } catch (err) {
      console.warn('Doc cleanup error:', err);
    }
  };

  const handleApprove = async (id: string, userId?: string) => {
    // Delete docs from storage BEFORE or ALONGSIDE the RPC
    await deleteDocsForApp(id, userId);

    const { error } = await configuredClient().rpc('approve_rakshak_application', { app_id: id });
    if (error) {
      notify(`❌ Failed to approve: ${error.message}`);
    } else {
      notify('✅ Rakshak approved & docs deleted from storage.');
      fetchApps();
      if (viewingDocs?.id === id) setViewingDocs(null);
    }
  };

  const handleReject = async (id: string, userId?: string) => {
    // Delete docs from storage BEFORE or ALONGSIDE the RPC
    await deleteDocsForApp(id, userId);

    const { error } = await configuredClient().rpc('reject_rakshak_application', { app_id: id });
    if (error) {
      notify(`❌ Failed to reject: ${error.message}`);
    } else {
      notify('Application rejected & docs deleted from storage.');
      fetchApps();
      if (viewingDocs?.id === id) setViewingDocs(null);
    }
  };

  const handlePurgeResidualDocs = async (app: RakshakAppItem) => {
    await deleteDocsForApp(app.id, app.userId);
    notify('✅ Documents deleted from storage.');
    setViewingDocs(null);
    fetchApps();
  };

  const handleSuspend = async (id: string) => {
    const { error } = await configuredClient().rpc('suspend_rakshak', { app_id: id });
    if (error) { notify('❌ Failed to suspend Rakshak.'); }
    else { notify('Rakshak suspended successfully.'); fetchApps(); }
  };

  const handleClose = async (id: string) => {
    const { error } = await configuredClient().rpc('close_rakshak', { app_id: id });
    if (error) { notify('❌ Failed to close Rakshak account.'); }
    else { notify('Rakshak account closed successfully.'); fetchApps(); }
  };

  const handleActivate = async (id: string) => {
    const { error } = await configuredClient().rpc('activate_rakshak', { app_id: id });
    if (error) { notify('❌ Failed to activate Rakshak.'); }
    else { notify('Rakshak activated successfully.'); fetchApps(); }
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

      {/* Document Viewer Modal */}
      {viewingDocs && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setViewingDocs(null)}>
          <div style={{
            background: '#fff',
            borderRadius: '20px 20px 0 0',
            padding: '20px',
            width: '100%',
            maxWidth: '430px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{viewingDocs.name}</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                  {viewingDocs.docType} · {viewingDocs.area}
                </p>
              </div>
              <button onClick={() => setViewingDocs(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Docs */}
            {viewingDocs.docs && viewingDocs.docs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {viewingDocs.docs.map((doc) => (
                  <div key={doc.id}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'capitalize', marginBottom: '6px' }}>
                      {doc.side} Side
                    </p>
                    {doc.signedUrl ? (
                      doc.mime_type?.includes('pdf') ? (
                        <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#f1f5f9', borderRadius: '8px', textDecoration: 'none', color: '#1e293b', fontSize: '13px' }}>
                          <FileText size={18} color="#6255ec" /> View PDF Document
                        </a>
                      ) : (
                        <img
                          src={doc.signedUrl}
                          alt={`${doc.side} side ID`}
                          style={{ width: '100%', borderRadius: '10px', border: '1px solid #e2e8f0', objectFit: 'cover', maxHeight: '220px' }}
                        />
                      )
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                        Could not load image
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No documents found.</p>
            )}

            {/* Approve / Reject / Purge from modal */}
            {viewingDocs.status === 'pending' ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => handleReject(viewingDocs.id, viewingDocs.userId)}
                  style={{ flex: 1, padding: '10px', background: '#ef4444', color: '#fff', borderRadius: '10px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}>
                  <X size={16} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(viewingDocs.id, viewingDocs.userId)}
                  style={{ flex: 1, padding: '10px', background: '#22c55e', color: '#fff', borderRadius: '10px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}>
                  <Check size={16} /> Approve
                </button>
              </div>
            ) : viewingDocs.docs && viewingDocs.docs.length > 0 ? (
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => handlePurgeResidualDocs(viewingDocs)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: '1px solid #fca5a5',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <X size={16} /> Delete Leftover Docs From Storage
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredApps.map((item) => (
          <div
            key={item.id}
            className="moderate-row"
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '14px',
              background: '#f8fafc',
              borderRadius: '12px',
              gap: '10px',
            }}
          >
            {/* Top row: Left [Applicant Name] | Right [View Docs] */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: 0,
              }}
            >
              <b style={{ fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1e293b' }}>
                {item.name}
                {item.status === 'verified' && <ShieldCheck size={14} color="#22c55e" />}
              </b>
              <button
                type="button"
                onClick={() => fetchDocs(item)}
                disabled={loadingDocs === item.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  background: '#ede9fe',
                  color: '#6255ec',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #c4b5fd',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: loadingDocs === item.id ? 0.6 : 1,
                  margin: 0,
                }}
              >
                <Eye size={12} />
                {loadingDocs === item.id ? 'Loading…' : 'View Docs'}
              </button>
            </div>

            {/* Underneath full from left to right: Doc Type, Area, Submitted Time */}
            <div
              style={{
                color: '#64748b',
                fontSize: '11.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                width: '100%',
                marginBottom: 0,
              }}
            >
              <span>Doc: {item.docType}</span>
              <span style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>Area: {item.area}</span>
              <span>Submitted: {item.submittedAt}</span>
            </div>

            {/* Action buttons stacked cleanly: Left [✕ Reject] | Right [✓ Approve] */}
            {item.status === 'pending' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '8px',
                  width: '100%',
                  marginTop: '2px',
                  marginBottom: 0,
                }}
              >
                <button
                  type="button"
                  className="reject"
                  onClick={() => handleReject(item.id, item.userId)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    border: 'none',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  <X size={15} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(item.id, item.userId)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#22c55e',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    border: 'none',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  <Check size={15} /> Approve
                </button>
              </div>
            )}

            {item.status === 'verified' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '8px',
                  width: '100%',
                  marginTop: '2px',
                  marginBottom: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSuspend(item.id)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: '#f59e0b',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  onClick={() => handleClose(item.id)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  Close
                </button>
              </div>
            )}

            {item.status === 'inactive' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  width: '100%',
                  marginTop: '2px',
                  marginBottom: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleActivate(item.id)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: '#22c55e',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  <Check size={14} /> Activate
                </button>
              </div>
            )}
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
