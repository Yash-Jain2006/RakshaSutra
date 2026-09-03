import React from 'react';
import { ShieldAlert, Home } from 'lucide-react';

interface NotFoundPageProps {
  nav: (page: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ nav }) => {
  return (
    <section className="screen">
      <header className="sub-header">
        <h1>404 - Not Found</h1>
      </header>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px', textAlign: 'center' }}>
        <ShieldAlert size={64} color="#64748b" style={{ marginBottom: '24px' }} />
        <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Page Not Found</h2>
        <p style={{ color: '#64748b', marginBottom: '32px', lineHeight: '1.5' }}>
          The page you are looking for doesn't exist or you don't have access to it.
        </p>
        <button 
          className="primary" 
          onClick={() => nav('home')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Home size={18} /> Return Home
        </button>
      </div>
    </section>
  );
};
