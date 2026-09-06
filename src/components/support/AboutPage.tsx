import React from 'react';
import { ArrowLeft, Heart, Users } from 'lucide-react';

interface AboutPageProps {
  nav: (page: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ nav }) => {
  return (
    <section className="screen" style={{ background: '#fafcff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingBottom: '20px', flex: 1 }}>
        
        {/* Custom Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '24px', padding: '0 4px' }}>
          <button 
            onClick={() => nav('settings')} 
            style={{ 
              background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', 
              width: '40px', height: '40px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <ArrowLeft size={18} color="#475569" />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '4px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
              About Raksha Sutra
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Our Story
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          
          {/* Main Card */}
          <div style={{ 
            background: '#fff', padding: '32px 20px', borderRadius: '24px', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)', textAlign: 'center', border: '1px solid #f1f5f9' 
          }}>
            
            {/* Raw Logo with no background */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <img src="/logo.png" alt="Raksha Sutra Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
              Built to keep women safe
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
              Raksha Sutra was created by a small team of engineers, designers and safety advocates who believe every woman deserves to feel secure — on her commute, her evening walk, or any moment she needs help fast.
            </p>
          </div>

          {/* Why we built this */}
          <div style={{ 
            background: '#fff', padding: '24px 20px', borderRadius: '24px', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Heart size={20} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Why we built this</h3>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
              Too many women hesitate before walking home alone, taking a late cab, or exploring a new city — not because they lack courage, but because help isn't always within reach. Raksha Sutra closes that gap with one tap: instant SOS, live tracking, and a verified network of Rakshaks ready to respond.
            </p>
          </div>

          {/* Who we are */}
          <div style={{ 
            background: '#fff', padding: '24px 20px', borderRadius: '24px', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Users size={20} color="#7c3aed" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Who we are</h3>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
              An independent safety-tech team working with local volunteers, NGOs and city partners to make Raksha Sutra's response network stronger every month.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
};
