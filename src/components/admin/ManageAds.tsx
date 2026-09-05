import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, Eye, EyeOff, Upload, Image as ImageIcon, Loader2, Link as LinkIcon } from 'lucide-react';
import { configuredClient } from '../../services/safetyService';

interface AdItem {
  id?: string;
  title: string;
  description: string;
  icon_emoji: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
}

interface ManageAdsProps {
  notify: (msg: string) => void;
}

/**
 * Resilient image processor & uploader.
 * Resizes and compresses image on client-side canvas.
 * Attempts upload to Supabase Storage 'ad-images' bucket;
 * seamlessly falls back to base64 DataURL if storage is unavailable.
 */
async function processAndUploadImage(file: File, client: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Invalid image file format.'));
      img.onload = async () => {
        try {
          const MAX_DIM = 800;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          // Try uploading to Supabase Storage bucket
          if (client && client.storage) {
            try {
              const res = await fetch(dataUrl);
              const blob = await res.blob();
              const fileName = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;

              const { data: uploadData, error: uploadErr } = await client.storage
                .from('ad-images')
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

              if (!uploadErr && uploadData) {
                const { data: pubData } = client.storage.from('ad-images').getPublicUrl(fileName);
                if (pubData?.publicUrl) {
                  resolve(pubData.publicUrl);
                  return;
                }
              } else if (uploadErr) {
                console.warn('Storage upload error, using compressed data URL:', uploadErr);
              }
            } catch (storageErr) {
              console.warn('Storage upload exception, using compressed data URL:', storageErr);
            }
          }

          // Fallback to data URL
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const ManageAds: React.FC<ManageAdsProps> = ({ notify }) => {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [showUrlInputs, setShowUrlInputs] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    const client = configuredClient();
    if (!client) return;
    setLoading(true);
    const { data, error } = await client
      .from('advertisements')
      .select('id, title, description, icon_emoji, image_url, is_active, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading ads:', error);
      notify('Failed to load ads.');
    } else {
      setAds(
        (data || []).map((ad) => ({
          ...ad,
          image_url: ad.image_url || '',
          icon_emoji: ad.icon_emoji || '🛒',
        }))
      );
    }
    setLoading(false);
  };

  const addAd = () => {
    if (ads.length >= 5) {
      notify('Maximum 5 ads allowed.');
      return;
    }
    setAds((prev) => [
      ...prev,
      {
        title: '',
        description: '',
        icon_emoji: '🛒',
        image_url: '',
        is_active: true,
        sort_order: prev.length,
      },
    ]);
  };

  const updateAd = (index: number, field: keyof AdItem, value: any) => {
    setAds((prev) => prev.map((ad, i) => (i === index ? { ...ad, [field]: value } : ad)));
  };

  const handleImageFileChange = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      notify('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify('Image must be under 10MB.');
      return;
    }

    const client = configuredClient();
    setUploadingIndex(index);
    try {
      const url = await processAndUploadImage(file, client);
      updateAd(index, 'image_url', url);
      notify('Product image uploaded successfully!');
    } catch (err: any) {
      console.error('Image processing error:', err);
      notify(`Image upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  const removeAd = async (index: number) => {
    const client = configuredClient();
    const ad = ads[index];
    if (ad.id && client) {
      const { error } = await client.from('advertisements').delete().eq('id', ad.id);
      if (error) {
        notify('Failed to delete ad.');
        return;
      }
    }
    setAds((prev) => prev.filter((_, i) => i !== index));
    notify('Ad removed.');
  };

  const saveAll = async () => {
    const client = configuredClient();
    if (!client) return;
    setSaving(true);

    try {
      for (let i = 0; i < ads.length; i++) {
        const ad = ads[i];
        if (!ad.title.trim()) {
          notify(`Ad #${i + 1} is missing a heading.`);
          setSaving(false);
          return;
        }

        const payload = {
          title: ad.title.trim(),
          description: ad.description.trim(),
          icon_emoji: ad.icon_emoji || '🛒',
          image_url: ad.image_url ? ad.image_url.trim() : '',
          is_active: ad.is_active,
          sort_order: i,
        };

        if (ad.id) {
          const { error } = await client.from('advertisements').update(payload).eq('id', ad.id);
          if (error) throw error;
        } else {
          const { data, error } = await client.from('advertisements').insert(payload).select('id').single();
          if (error) throw error;
          ads[i].id = data.id;
        }
      }
      notify('All ads saved successfully!');
      await loadAds();
    } catch (err: any) {
      console.error('Error saving ads:', err);
      notify(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-card" style={{ textAlign: 'center', padding: '32px' }}>
        <p style={{ color: '#64748b' }}>Loading ads…</p>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Manage Sponsor Ads</h3>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{ads.length}/5</span>
      </div>

      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px' }}>
        Upload product images and headings. Ads appear as a scrolling banner on the Home screen. Maximum 5 ads.
      </p>

      {ads.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
          No ads configured yet. Click "Add Ad" to create one.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {ads.map((ad, index) => (
          <div
            key={ad.id || `new-${index}`}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px',
              background: ad.is_active ? '#fafffe' : '#fafafa',
              transition: 'all 0.2s',
            }}
          >
            {/* Header: Ad # and Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <GripVertical size={14} color="#cbd5e1" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>AD #{index + 1}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => updateAd(index, 'is_active', !ad.is_active)}
                  title={ad.is_active ? 'Deactivate' : 'Activate'}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: ad.is_active ? '#dcfce7' : '#f1f5f9',
                    color: ad.is_active ? '#16a34a' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  {ad.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                  {ad.is_active ? 'Active' : 'Hidden'}
                </button>
                <button
                  type="button"
                  onClick={() => removeAd(index)}
                  title="Remove ad"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#fee2e2',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Product Image Uploader (replaces Emoji Icons) */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                  Product Ad Image
                </label>
                {ad.image_url && (
                  <button
                    type="button"
                    onClick={() => updateAd(index, 'image_url', '')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    <Trash2 size={11} /> Remove Image
                  </button>
                )}
              </div>

              {ad.image_url ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <img
                      src={ad.image_url}
                      alt="Product Ad"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                      Product Image Loaded
                    </p>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: '10px',
                        color: '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={ad.image_url}
                    >
                      {ad.image_url.startsWith('data:') ? 'Compressed image ready' : ad.image_url}
                    </p>
                  </div>
                  <label
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#475569',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: uploadingIndex === index ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                  >
                    {uploadingIndex === index ? (
                      <Loader2 size={12} className="spin" color="#6c63f2" />
                    ) : (
                      <Upload size={12} />
                    )}
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingIndex === index}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFileChange(index, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div>
                  <label
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: '#f8fafc',
                      cursor: uploadingIndex === index ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingIndex === index}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFileChange(index, file);
                        e.target.value = '';
                      }}
                    />
                    {uploadingIndex === index ? (
                      <>
                        <Loader2 size={24} color="#6c63f2" className="spin" />
                        <span style={{ fontSize: '11px', color: '#6c63f2', fontWeight: 600 }}>
                          Uploading and optimizing image…
                        </span>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: '#ede9fe',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#6c63f2',
                          }}
                        >
                          <Upload size={18} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#4338ca' }}>
                            Click to upload product image
                          </span>
                          <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>
                            PNG, JPG, WebP up to 10MB
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>
              )}

              {/* Direct URL input option */}
              {showUrlInputs[index] ? (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <input
                    type="url"
                    placeholder="https://example.com/product-image.jpg"
                    value={ad.image_url}
                    onChange={(e) => updateAd(index, 'image_url', e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowUrlInputs((prev) => ({ ...prev, [index]: false }))}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setShowUrlInputs((prev) => ({ ...prev, [index]: true }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6c63f2',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: 0,
                    }}
                  >
                    <LinkIcon size={10} />
                    {ad.image_url ? 'Edit Image URL directly' : 'Or enter Image URL directly'}
                  </button>
                </div>
              )}
            </div>

            {/* Heading */}
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Heading
            </label>
            <input
              type="text"
              value={ad.title}
              onChange={(e) => updateAd(index, 'title', e.target.value)}
              placeholder="e.g. Shopping"
              maxLength={40}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />

            {/* Description */}
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Description
            </label>
            <input
              type="text"
              value={ad.description}
              onChange={(e) => updateAd(index, 'description', e.target.value)}
              placeholder="e.g. Everything at cheaper price"
              maxLength={80}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button
          type="button"
          onClick={addAd}
          disabled={ads.length >= 5}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '10px',
            border: '2px dashed #e2e8f0',
            background: 'transparent',
            color: ads.length >= 5 ? '#cbd5e1' : '#6c63f2',
            fontSize: '12px',
            fontWeight: 700,
            cursor: ads.length >= 5 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Plus size={14} /> Add Ad
        </button>
        <button
          type="button"
          onClick={saveAll}
          disabled={saving || ads.length === 0}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '10px',
            border: 'none',
            background: saving ? '#94a3b8' : '#6c63f2',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>
    </div>
  );
};
