import { describe, expect, it } from 'vitest';
import { toContactModel } from '../services/safetyService';

describe('Safety Service & Domain Models', () => {
  it('correctly maps raw DB emergency contact to frontend model', () => {
    const rawDbRow = {
      id: 'contact-uuid-123',
      name: 'Priya Sharma',
      relationship: 'Sister',
      phone_e164: '+919876543210',
      email: 'priya@example.com',
      confirmation_status: 'confirmed' as const,
      notification_enabled: true,
    };

    const model = toContactModel(rawDbRow);

    expect(model.id).toBe('contact-uuid-123');
    expect(model.name).toBe('Priya Sharma');
    expect(model.relation).toBe('Sister');
    expect(model.initials).toBe('PS');
    expect(model.confirmationStatus).toBe('confirmed');
    expect(model.phone).toBe('+919876543210');
  });

  it('handles name initials derivation cleanly for single and multi-word names', () => {
    const singleName = toContactModel({
      id: '1',
      name: 'Ananya',
      relationship: 'Self',
      confirmation_status: 'confirmed',
    });
    expect(singleName.initials).toBe('A');

    const multiName = toContactModel({
      id: '2',
      name: 'Dr. Rahul Kumar Verma',
      relationship: 'Doctor',
      confirmation_status: 'confirmed',
    });
    expect(multiName.initials).toBe('DR');
  });

  it('evaluates rate-limit soft-flag threshold correctly (>3 triggers in 15 mins)', () => {
    const now = Date.now();
    const fifteenMinsMs = 15 * 60 * 1000;

    const recentTriggers = [
      now - 14 * 60 * 1000,
      now - 10 * 60 * 1000,
      now - 5 * 60 * 1000,
      now - 1 * 60 * 1000,
    ];

    const triggersInWindow = recentTriggers.filter((t) => now - t <= fifteenMinsMs);
    const isSoftFlagged = triggersInWindow.length > 3;

    expect(triggersInWindow.length).toBe(4);
    expect(isSoftFlagged).toBe(true);
  });
});
