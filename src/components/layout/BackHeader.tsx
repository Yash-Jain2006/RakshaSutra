import React from 'react';
import { ArrowLeft } from 'lucide-react';

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
