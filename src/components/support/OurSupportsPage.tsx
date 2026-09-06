import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHeader } from '../layout/BackHeader.tsx';
import { configuredClient } from '../../services/safetyService';

interface OurSupportsPageProps {
  nav: (page: string) => void;
}

interface OurSupport {
  id: string;
  name: string;
  title: string;
  location: string;
  image_url: string;
}

export const OurSupportsPage: React.FC<OurSupportsPageProps> = ({ nav }) => {
  const { t } = useTranslation();
  const [supports, setSupports] = useState<OurSupport[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <section className="screen">
      <BackHeader title="Our Supports" onBack={() => nav('settings')} />
      
      <div className="scroll-content" style={{ padding: '24px 20px', paddingBottom: '100px' }}>
        <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.5, marginBottom: '24px' }}>
          Meet our ambassadors, partners, and key supporters who make our mission possible.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading supports...</div>
        ) : supports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8' }}>
            No supports added yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {supports.map(support => (
              <div key={support.id} style={{ 
                background: '#fff', borderRadius: '16px', padding: '20px 16px', 
                textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                <img 
                  src={support.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(support.name)}&background=random`} 
                  alt={support.name} 
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px', border: '2px solid #7c3aed' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(support.name)}&background=random`;
                  }}
                />
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{support.name}</h4>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{support.title}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{support.location}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
