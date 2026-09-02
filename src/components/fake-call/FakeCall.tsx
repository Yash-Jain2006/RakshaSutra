import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, X } from 'lucide-react';

interface FakeCallProps {
  close: () => void;
  callerName?: string;
  callerRelation?: string;
}

export const FakeCall: React.FC<FakeCallProps> = ({
  close,
  callerName = 'Meera Iyer',
  callerRelation = 'Sister · mobile',
}) => {
  const [callState, setCallState] = useState<'incoming' | 'connected'>('incoming');
  const [callDuration, setCallDuration] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringOscRef = useRef<OscillatorNode | null>(null);

  // Play synthetic telephone ring using Web Audio API (no external MP3/audio files needed)
  useEffect(() => {
    if (callState !== 'incoming') return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringOscRef.current = osc;

      // Vibrate phone if browser supports it
      if (navigator.vibrate) {
        navigator.vibrate([400, 800, 400, 800]);
      }
    } catch {
      // Web Audio API may be restricted until user gesture; fail silently
    }

    return () => {
      stopRingtone();
    };
  }, [callState]);

  // Handle call duration timer when accepted
  useEffect(() => {
    if (callState !== 'connected') return;

    const interval = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [callState]);

  const stopRingtone = () => {
    if (ringOscRef.current) {
      try {
        ringOscRef.current.stop();
      } catch {
        // Ignored
      }
      ringOscRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  };

  const acceptCall = () => {
    stopRingtone();
    setCallState('connected');
  };

  const declineCall = () => {
    stopRingtone();
    close();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fake-call" role="dialog" aria-label={`Fake call from ${callerName}`}>
      <button className="fake-close" onClick={declineCall} aria-label="End fake call overlay">
        <X />
      </button>

      <div className="caller-avatar" aria-hidden="true">
        {callerName.charAt(0)}
      </div>

      <p className="fake-status">
        {callState === 'incoming' ? 'Incoming call' : `In call · ${formatDuration(callDuration)}`}
      </p>
      <h2>{callerName}</h2>
      <span>{callerRelation}</span>

      <div className="call-actions">
        {callState === 'incoming' ? (
          <>
            <button onClick={declineCall} className="decline-btn">
              <span className="decline">
                <PhoneOff size={22} />
              </span>
              Decline
            </button>
            <button onClick={acceptCall} className="accept-btn">
              <span className="accept">
                <Phone size={22} />
              </span>
              Accept
            </button>
          </>
        ) : (
          <button onClick={declineCall} className="end-call-btn" style={{ gridColumn: 'span 2' }}>
            <span className="decline" style={{ width: '64px', height: '64px' }}>
              <PhoneOff size={28} />
            </span>
            End Call
          </button>
        )}
      </div>
    </div>
  );
};
