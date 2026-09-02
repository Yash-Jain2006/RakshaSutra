import React from 'react';

interface SectionTitleProps {
  title: string;
  action?: string;
  onClick?: () => void;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, action, onClick }) => {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action && <button onClick={onClick}>{action}</button>}
    </div>
  );
};
