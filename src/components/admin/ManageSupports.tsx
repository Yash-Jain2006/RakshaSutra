import React, { useState, useEffect } from 'react';
import { configuredClient } from '../../services/safetyService';
import { Trash2, Upload, Link as LinkIcon, Plus, UserCircle } from 'lucide-react';

interface OurSupport {
  id: string;
  name: string;
  title: string;
  location: string;
  image_url: string;
}

export const ManageSupports: React.FC = () => {
  const [supports, setSupports] = useState<OurSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  const [uploading, setUploading] = useState(false);

  const client = configuredClient();

  useEffect(() => {
    fetchSupports();
  }, []);

  const fetchSupports = async () => {
    setLoading(true);
    const { data, error } = await client
      .from('our_supports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSupports(data);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await client.storage
      .from('support-images')
      .upload(filePath, file);

    if (uploadError) {
      alert('Error uploading image: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = client.storage.from('support-images').getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const handleAddSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !title || !location) {
      alert('Please fill in name, title, and location');
      return;
    }

    setSaving(true);
    const { error } = await client.from('our_supports').insert([
      { name, title, location, image_url: imageUrl }
    ]);

    if (error) {
      alert('Error adding support: ' + error.message);
    } else {
      setName('');
      setTitle('');
      setLocation('');
      setImageUrl('');
      fetchSupports();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this support?')) return;
    
    const { error } = await client.from('our_supports').delete().eq('id', id);
    if (error) {
      alert('Error deleting: ' + error.message);
    } else {
      fetchSupports();
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} color="#7c3aed" />
          Add New Support / Ambassador
        </h3>
        
        <form onSubmit={handleAddSupport} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Name</label>
              <input 
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Aditi Sharma"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Title/Role</label>
              <input 
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Community Ambassador"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                required
              />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Location</label>
            <input 
              value={location} onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Mumbai, India"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Profile Image</label>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
                background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '8px', 
                cursor: 'pointer', fontSize: '14px', color: '#475569', fontWeight: 500
              }}>
                <Upload size={16} />
                {uploading ? 'Uploading...' : 'Upload Image'}
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>or paste URL below</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px' }}>
              <LinkIcon size={16} color="#94a3b8" />
              <input 
                value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                style={{ width: '100%', padding: '10px 8px', border: 'none', fontSize: '14px', outline: 'none' }}
              />
            </div>
            {imageUrl && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={imageUrl} alt="Preview" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>Image preview ready</span>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={saving || uploading}
            style={{ 
              padding: '12px', background: '#7c3aed', color: '#fff', border: 'none', 
              borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: (saving || uploading) ? 'not-allowed' : 'pointer',
              opacity: (saving || uploading) ? 0.7 : 1, marginTop: '8px'
            }}
          >
            {saving ? 'Adding...' : 'Add Support'}
          </button>
        </form>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Existing Supports</h3>
        </div>
        
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : supports.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No supports found.</div>
        ) : (
          <div style={{ borderTop: '1px solid #e2e8f0' }}>
            {supports.map(support => (
              <div key={support.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img 
                    src={support.image_url} 
                    alt={support.name} 
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(support.name)}&background=random`;
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{support.name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{support.title} • {support.location}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(support.id)}
                  style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Delete Support"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
