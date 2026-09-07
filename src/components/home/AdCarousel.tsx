import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Ad {
  id: string;
  title: string;
  description: string;
  icon_emoji: string;
  image_url?: string | null;
}

interface AdCarouselProps {
  notify: (msg: string) => void;
}

export const AdCarousel: React.FC<AdCarouselProps> = ({ notify }) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    if (!supabase) {
      setAds([]);
      return;
    }
    const { data, error } = await supabase
      .from('advertisements')
      .select('id, title, description, icon_emoji, image_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(5);

    if (error || !data || data.length === 0) {
      setAds([]);
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
    const interval = setInterval(next, 3000);
    return () => clearInterval(interval);
  }, [ads.length, next]);

  if (ads.length === 0) return null;

  return (
    <div className="ad-carousel-wrapper">
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
        <div className="ad-track">
          <div
            className="ad-slides"
            style={{
              transform: `translateX(-${current * 100}%)`,
              transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {ads.map((ad) => (
              <div className="ad-card" key={ad.id} style={{ padding: 0, background: 'transparent' }}>
                {ad.image_url ? (
                  <img
                    src={ad.image_url}
                    alt="Advertisement"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
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
