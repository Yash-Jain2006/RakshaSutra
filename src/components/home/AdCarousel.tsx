import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Ad {
  id: string;
  title: string;
  description: string;
  icon_emoji: string;
}

interface AdCarouselProps {
  notify: (msg: string) => void;
}

export const AdCarousel: React.FC<AdCarouselProps> = ({ notify }) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    if (!supabase) {
      // Fallback to a default ad if no supabase
      setAds([{ id: 'default', title: 'SafeStep Shoes', description: 'Grip-tech footwear for city commutes', icon_emoji: '🛒' }]);
      return;
    }
    const { data, error } = await supabase
      .from('advertisements')
      .select('id, title, description, icon_emoji')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(5);

    if (error || !data || data.length === 0) {
      // Show a default placeholder ad
      setAds([{ id: 'default', title: 'Raksha Sutra', description: 'Your personal safety companion', icon_emoji: '🛡️' }]);
    } else {
      setAds(data);
    }
  };

  const goTo = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % ads.length);
  }, [ads.length]);

  const prev = useCallback(() => {
    setCurrent((p) => (p - 1 + ads.length) % ads.length);
  }, [ads.length]);

  // Auto-scroll every 4 seconds
  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(next, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ads.length, next]);

  // Pause auto-scroll on touch/hover
  const pauseAuto = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resumeAuto = () => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(next, 4000);
  };

  if (ads.length === 0) return null;

  return (
    <div
      className="ad-carousel-wrapper"
      onMouseEnter={pauseAuto}
      onMouseLeave={resumeAuto}
      onTouchStart={pauseAuto}
      onTouchEnd={resumeAuto}
    >
      <div className="ad-carousel">
        {/* Left Arrow */}
        {ads.length > 1 && (
          <button
            className="ad-arrow ad-arrow-left"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous ad"
          >
            <ChevronLeft size={14} />
          </button>
        )}

        {/* Track */}
        <div className="ad-track" ref={trackRef}>
          <div
            className="ad-slides"
            style={{
              transform: `translateX(-${current * 100}%)`,
              transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {ads.map((ad) => (
              <div className="ad-card" key={ad.id}>
                <div className="ad-icon">{ad.icon_emoji}</div>
                <div className="ad-content">
                  <span>SPONSORED</span>
                  <b>{ad.title}</b>
                  <p>{ad.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Arrow */}
        {ads.length > 1 && (
          <button
            className="ad-arrow ad-arrow-right"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next ad"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Dots */}
      {ads.length > 1 && (
        <div className="ad-dots" aria-hidden="true">
          {ads.map((_, i) => (
            <button
              key={i}
              className={`ad-dot ${i === current ? 'active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
