import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdItem {
  id?: string;
  title: string;
  description: string;
  icon_emoji: string;
  is_active: boolean;
  sort_order: number;
}

interface ManageAdsProps {
  notify: (msg: string) => void;
}

export const ManageAds: React.FC<ManageAdsProps> = ({ notify }) => {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('advertisements')
      .select('id, title, description, icon_emoji, is_active, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading ads:', error);
      notify('Failed to load ads.');
    } else {
      setAds(data || []);
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
        is_active: true,
        sort_order: prev.length,
      },
    ]);
  };

  const updateAd = (index: number, field: keyof AdItem, value: any) => {
    setAds((prev) => prev.map((ad, i) => (i === index ? { ...ad, [field]: value } : ad)));
  };

  const removeAd = async (index: number) => {
    const ad = ads[index];
    if (ad.id && supabase) {
      const { error } = await supabase.from('advertisements').delete().eq('id', ad.id);
      if (error) {
        notify('Failed to delete ad.');
        return;
      }
    }
    setAds((prev) => prev.filter((_, i) => i !== index));
    notify('Ad removed.');
  };

  const saveAll = async () => {
    if (!supabase) return;
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
          is_active: ad.is_active,
          sort_order: i,
          image_url: '',
        };

        if (ad.id) {
          const { error } = await supabase.from('advertisements').update(payload).eq('id', ad.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('advertisements').insert(payload).select('id').single();
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

  const EMOJI_OPTIONS = ['🛒', '👟', '🛡️', '💊', '📱', '🏠', '🚕', '☕', '🎓', '💪', '🌸', '🔒', '⚡', '🎯', '🏥', '🍎'];

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
        Ads appear as a scrolling banner on the Home screen. Maximum 5 ads.
      </p>

      {ads.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
          No ads configured yet. Click "Add Ad" to create one.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <GripVertical size={14} color="#cbd5e1" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>AD #{index + 1}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button
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

            {/* Icon Picker */}
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Icon
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => updateAd(index, 'icon_emoji', emoji)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: ad.icon_emoji === emoji ? '2px solid #6c63f2' : '1px solid #e2e8f0',
                    background: ad.icon_emoji === emoji ? '#f0eeff' : '#fff',
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Heading */}
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Heading
            </label>
            <input
              type="text"
              value={ad.title}
              onChange={(e) => updateAd(index, 'title', e.target.value)}
              placeholder="e.g. SafeStep Shoes"
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
              placeholder="e.g. Grip-tech footwear for city commutes"
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
