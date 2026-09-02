import React from 'react';
import { HeartHandshake, Phone } from 'lucide-react';
import { SectionTitle } from '../common/SectionTitle';
import { BackHeader } from '../layout/BackHeader';

interface SupportPageProps {
  nav: (page: string) => void;
}

export const SupportPage: React.FC<SupportPageProps> = ({ nav }) => {
  const helplines = [
    ['National Emergency', '112', 'Immediate emergency response'],
    ['Women Helpline', '181', '24/7 women’s support and guidance'],
    ['Women Safety Helpline', '1091', 'Police support and referral'],
  ];

  return (
    <section className="screen support-screen">
      <BackHeader title="Support & toolkit" nav={nav} />

      <div className="support-hero">
        <HeartHandshake size={31} />
        <h2>You don’t have to handle it alone.</h2>
        <p>Free, confidential support is available whenever you need it.</p>
      </div>

      <div className="support-list">
        {helplines.map(([name, number, desc]) => (
          <a href={`tel:${number}`} key={number} aria-label={`Call ${name} at ${number}`}>
            <span>
              <Phone size={19} />
            </span>
            <div>
              <b>{name}</b>
              <small>{desc}</small>
            </div>
            <strong>{number}</strong>
          </a>
        ))}
      </div>

      <SectionTitle title="Safety toolkit" />
      <div className="support-tips">
        {[
          'Share your journey with someone you trust.',
          'Stay in lit, populated places when possible.',
          'Trust your instinct — use SOS if you feel unsafe.',
        ].map((tip, i) => (
          <p key={tip}>
            <span>{i + 1}</span>
            {tip}
          </p>
        ))}
      </div>
    </section>
  );
};
