import type {
  AccountStatus,
  AppRole,
  ContactConfirmationStatus,
  DeliveryRecipientType,
  DeliveryStatus,
  JourneyStatus,
  LocationSource,
  RakshakComplaintStatus,
  RakshakStatus,
  SosStatus,
} from './enums';

export interface Profile {
  id: string;
  display_name: string;
  role: AppRole;
  account_status: AccountStatus;
  preferred_language: string;
  city?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface EmergencyContact {
  id: string | number;
  name: string;
  relation: string;
  phone?: string | null;
  email?: string | null;
  initials: string;
  color: string;
  confirmationStatus: ContactConfirmationStatus;
  notificationEnabled?: boolean;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  source: LocationSource;
}

export interface SosEvent {
  id: string;
  user_id: string;
  status: SosStatus;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  location_source: LocationSource;
  map_session_token?: string;
  accepted_rakshak_id?: string | null;
  started_at: string;
  cancelled_at?: string | null;
  safe_at?: string | null;
  ended_at?: string | null;
}

export interface SosDelivery {
  id: string;
  sos_event_id: string;
  recipient_type: DeliveryRecipientType;
  contact_id?: string | null;
  rakshak_id?: string | null;
  channel: 'push' | 'sms' | 'email' | 'in_app';
  status: DeliveryStatus;
  sent_at?: string | null;
  delivered_at?: string | null;
  acknowledged_at?: string | null;
  recipient_name?: string;
  recipient_sub?: string;
}

export interface RakshakHelper {
  id: string | number;
  name: string;
  area: string;
  rating: string;
  eta: string;
  initials: string;
  active: boolean;
}

export interface SafePlace {
  id: string | number;
  name: string;
  type: 'Police' | 'Hospital' | 'Cafe' | 'Fuel Station';
  distance: string;
  x: number;
  y: number;
}

export interface IncidentReport {
  id: string | number;
  place: string;
  time: string;
  text: string;
  rating: 'Safe' | 'Unsafe';
  anonymous: boolean;
  status: string;
}

export interface JourneySession {
  id?: string;
  destination: string;
  viewers: EmergencyContact[];
  status: JourneyStatus;
  startedAt: string;
}

export interface RakshakApplicationData {
  documentType: 'Aadhaar' | 'PAN Card' | 'Driving Licence';
  fullName: string;
  coverageArea: string;
  frontUploaded: boolean;
  backUploaded: boolean;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
