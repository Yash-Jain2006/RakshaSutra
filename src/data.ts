import type { EmergencyContact, IncidentReport, RakshakHelper, SafePlace } from './types/models';

export const safePlaces: SafePlace[] = [
  { id: 1, name: 'Koramangala Police Station', type: 'Police', distance: '0.8 km', x: 23, y: 48 },
  { id: 2, name: 'St. John\'s Hospital', type: 'Hospital', distance: '1.1 km', x: 69, y: 31 },
  { id: 3, name: 'Night Owl Café', type: 'Cafe', distance: '0.4 km', x: 57, y: 66 },
  { id: 4, name: 'Indian Oil Fuel Station', type: 'Fuel Station', distance: '0.6 km', x: 34, y: 79 },
];

export const rakshaks: RakshakHelper[] = [
  { id: 1, name: 'Priya Kulkarni', area: 'Koramangala', rating: '4.9', eta: '4 min', initials: 'PK', active: true },
  { id: 2, name: 'Arjun Rao', area: 'HSR Layout', rating: '4.8', eta: '7 min', initials: 'AR', active: true },
  { id: 3, name: 'Kavya Nair', area: 'Indiranagar', rating: '4.9', eta: '11 min', initials: 'KN', active: true },
];

/** Default RakshaSutra contact — always present, cannot be removed */
export const DEFAULT_RAKSHASUTRA_CONTACT: EmergencyContact = {
  id: 'default-rakshasutra',
  name: 'RakshaSutra',
  relation: '',
  phone: '+919343899579',
  email: 'rakshaasutra@gmail.com',
  initials: 'RS',
  color: '#6255ec',
  confirmationStatus: 'confirmed',
};

export const initialContacts = [
  DEFAULT_RAKSHASUTRA_CONTACT,
  { id: 1, name: 'Meera Iyer', relation: 'Sister', initials: 'MI', color: '#6255ec', confirmationStatus: 'confirmed' as const },
  { id: 2, name: 'Rohan Sharma', relation: 'Friend', initials: 'RS', color: '#ef7c74', confirmationStatus: 'confirmed' as const },
  { id: 3, name: 'Dr. Kapoor', relation: 'Family Doctor', initials: 'DK', color: '#2ebc90', confirmationStatus: 'confirmed' as const },
];

export const reportSeed: IncidentReport[] = [
  { id: 1, place: 'Silk Board Underpass', time: 'Today · 8:15 PM', text: 'Street lights have been off for two days. Please use the service road after dark.', rating: 'Unsafe', anonymous: true, status: 'Verified' },
  { id: 2, place: '100 Feet Road, Indiranagar', time: 'Yesterday · 6:40 PM', text: 'Well-lit and busy in the evening. Security guard near the metro exit was helpful.', rating: 'Safe', anonymous: false, status: 'Community report' },
];
