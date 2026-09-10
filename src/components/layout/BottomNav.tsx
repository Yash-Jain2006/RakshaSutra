import React from 'react';
import { Compass, HeartHandshake, Map as MapIcon, SlidersHorizontal, UsersRound, ArrowLeft, MessageSquare } from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface BottomNavProps {
  page: string;
  nav: (page: string) => void;
  isAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ page, nav, isAdmin }) => {
  const { t } = useTranslation();
  
  const items: [string, React.ElementType, string][] = [
    ['home', Compass, t('nav.home', 'Home')],
    ['map', MapIcon, t('nav.map', 'Map')],
    ['rakshak', UsersRound, t('nav.rakshaks', 'Rakshaks')],
    ['community', MessageSquare, t('nav.community', 'Community')],
    ['support-supports', HeartHandshake, t('nav.our_supports', 'Supports')],
  ];

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map(([id, Icon, label]) => (
        <button
          key={id}
          className={page === id ? 'selected' : ''}
          onClick={() => nav(id)}
          aria-current={page === id ? 'page' : undefined}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
      {isAdmin && (
        <button
          className={page === 'admin' ? 'selected' : ''}
          onClick={() => nav('admin')}
          aria-current={page === 'admin' ? 'page' : undefined}
        >
          <SlidersHorizontal size={20} />
          <span>Admin</span>
        </button>
      )}
    </nav>
  );
};


interface BackHeaderProps {
  title: string;
  nav: (page: string) => void;
  extra?: React.ReactNode;
}

export const BackHeader: React.FC<BackHeaderProps> = ({ title, nav, extra }) => {
  return (
    <header className="sub-header">
      <button onClick={() => nav('home')} aria-label="Back to Home">
        <ArrowLeft size={20} />
      </button>
      <h1>{title}</h1>
      {extra || <span />}
    </header>
  );
};
