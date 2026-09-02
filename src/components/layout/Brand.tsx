import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Brand: React.FC = () => {
  return (
    <div className="brand">
      <span className="brand-mark">
        <ShieldCheck size={18} />
      </span>
      <span>Raksha Sutra</span>
    </div>
  );
};

export const StatusBar: React.FC = () => {
  return (
    <div className="statusbar" aria-hidden="true">
      <span>9:41</span>
      <span className="status-icons">
        <span>▮▮▮</span>
        <span>◒</span>
      </span>
    </div>
  );
};
