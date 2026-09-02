import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Coffee,
  Flame,
  Fuel,
  Hospital,
  Map as MapIcon,
  Navigation,
  Search,
  Shield,
} from 'lucide-react';
import { safePlaces } from '../../data';
import { SectionTitle } from '../common/SectionTitle';
import { BackHeader } from '../layout/BackHeader';

interface MapPageProps {
  nav: (page: string) => void;
}

const IconByType: React.FC<{ type: string; size?: number }> = ({ type, size = 18 }) => {
  const props = { size, strokeWidth: 2.15 };
  return type === 'Police' ? (
    <Shield {...props} />
  ) : type === 'Hospital' ? (
    <Hospital {...props} />
  ) : type === 'Cafe' ? (
    <Coffee {...props} />
  ) : (
    <Fuel {...props} />
  );
};

export const MapPage: React.FC<MapPageProps> = ({ nav }) => {
  const [filter, setFilter] = useState('All');
  const [heat, setHeat] = useState(true);
  const [search, setSearch] = useState('');

  const places = useMemo(
    () =>
      safePlaces.filter(
        (p) =>
          (filter === 'All' || p.type === filter) &&
          p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [filter, search]
  );

  return (
    <section className="screen map-screen">
      <BackHeader
        title="Safe places near you"
        nav={nav}
        extra={
          <button className="heat-toggle" onClick={() => setHeat(!heat)}>
            <Flame size={17} />
            {heat ? 'Heatmap on' : 'Heatmap off'}
          </button>
        }
      />
      <div className="search">
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a place or area in Bengaluru"
        />
      </div>
      <div className="filters">
        {['All', 'Police', 'Hospital', 'Cafe', 'Fuel Station'].map((item) => (
          <button
            className={filter === item ? 'selected' : ''}
            key={item}
            onClick={() => setFilter(item)}
          >
            {item !== 'All' && <IconByType type={item} size={15} />} {item}
          </button>
        ))}
      </div>
      <div className={`map-canvas ${heat ? 'heat-visible' : ''}`}>
        <div className="street s-one" />
        <div className="street s-two" />
        <div className="street s-three" />
        <div className="route">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        {heat && (
          <>
            <span className="heat heat-green" />
            <span className="heat heat-orange" />
            <span className="heat heat-red" />
          </>
        )}
        {places.map((place) => (
          <button
            className="place-pin"
            key={place.id}
            style={{ left: `${place.x}%`, top: `${place.y}%` }}
            aria-label={place.name}
          >
            <IconByType type={place.type} size={16} />
            <span>{place.name.split(' ')[0]}</span>
          </button>
        ))}
        <div className="you-pin">
          <Navigation size={15} />
        </div>
        <div className="map-legend">
          <span><i className="green" /> Safer</span>
          <span><i className="orange" /> Caution</span>
          <span><i className="red" /> Avoid</span>
        </div>
      </div>
      <div className="route-card">
        <span className="route-icon">
          <Navigation size={19} />
        </span>
        <div>
          <p>Suggested safer route (Guidance only)</p>
          <b>Via 80 Feet Road</b>
          <small>8 min · Well-lit route</small>
        </div>
        <button aria-label="Route details">
          <ChevronRight size={19} />
        </button>
      </div>

      <SectionTitle title="Nearby safe places" />
      <div className="places-list">
        {places.map((place) => (
          <div className="place-row" key={place.id}>
            <span className={`place-type ${place.type.replace(' ', '-').toLowerCase()}`}>
              <IconByType type={place.type} />
            </span>
            <div>
              <b>{place.name}</b>
              <small>
                {place.type} · {place.distance} away
              </small>
            </div>
            <ChevronRight size={18} />
          </div>
        ))}
        {places.length === 0 && (
          <p className="empty-state">No safe places match your search.</p>
        )}
      </div>
    </section>
  );
};
