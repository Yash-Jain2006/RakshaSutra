import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { countryCodes } from '../../data/countryCodes';

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = countryCodes.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.code.includes(search)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="country-select-wrapper" ref={wrapperRef} style={{ position: 'relative' }}>
      <button 
        type="button" 
        className="rakshak-light-form country-select"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          borderRadius: '8px',
          padding: '10px', fontSize: '13px', color: '#1e293b', cursor: 'pointer',
          minWidth: '70px', justifyContent: 'center'
        }}
      >
        {value} <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '4px',
          background: '#ffffff', border: '1px solid #e2dcf2', borderRadius: '8px',
          width: '240px', maxHeight: '300px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #e2dcf2', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="#94a3b8" />
            <input 
              autoFocus
              type="text" 
              placeholder="Search country..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '12px', background: 'transparent' }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => { onChange(c.code); setIsOpen(false); setSearch(''); }}
                style={{
                  display: 'flex', justifyContent: 'space-between', width: '100%',
                  padding: '8px 12px', background: 'transparent', border: 'none',
                  fontSize: '12px', cursor: 'pointer', textAlign: 'left',
                  alignItems: 'center', gap: '8px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f3efff'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: '#1e293b', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{c.code}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No countries found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
