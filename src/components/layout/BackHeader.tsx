import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface BackHeaderProps {
  title: string;
  nav?: (page: string) => void;
  onBack?: () => void;
  extra?: React.ReactNode;
}

export const BackHeader: React.FC<BackHeaderProps> = ({ title, nav, onBack, extra }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (nav) {
      nav('home');
    }
  };

  return (
    <header className="sub-header">
      <button onClick={handleBack} aria-label="Go Back">
        <ArrowLeft size={20} />
      </button>
      <h1>{title}</h1>
      {extra || <span />}
    </header>
  );
};
