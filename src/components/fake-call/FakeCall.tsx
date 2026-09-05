import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, X } from 'lucide-react';

interface FakeCallProps {
  close: () => void;
  callerName?: string;
  callerRelation?: string;
  ringtone?: string;
}

export const FakeCall: React.FC<FakeCallProps> = ({
  close,
  callerName = 'Meera Iyer',
  callerRelation = 'Sister · mobile',
  ringtone = 'default',
}) => {
  const [callState, setCallState] = useState<'incoming' | 'connected'>('incoming');
  const [callDuration, setCallDuration] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringOscRef = useRef<OscillatorNode | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  // Play synthetic telephone ring using Web Audio API (no external MP3/audio files needed)
  useEffect(() => {
    if (callState !== 'incoming') return;

    try {
      if (ringtone === 'vibrate') {
        // Just vibrate, no sound
        if (navigator.vibrate) navigator.vibrate([400, 800, 400, 800, 400, 800]);
        return;
      }

      if (ringtone === 'custom') {
        const audioData = localStorage.getItem('fakeCallCustomAudio');
        if (audioData) {
          const audio = new Audio(audioData);
          audio.loop = true;
          audio.play().catch(e => console.error("Custom ringtone playback failed", e));
          customAudioRef.current = audio;
        }
        if (navigator.vibrate) navigator.vibrate([400, 800, 400, 800, 400, 800]);
        return; // Skip Web Audio oscillator
      }

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      
      const osc = ctx.createOscillator();

      if (ringtone === 'classic') {
        // Classic ring: 400Hz + 450Hz sine waves, modulated by an LFO or just pulsing
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        osc2.connect(masterGain);
        osc2.start();
        
        // Pulse pattern for classic (e.g., UK ring 0.4s on, 0.2s off, 0.4s on, 2s off)
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        for (let i = 0; i < 20; i++) {
          const t = ctx.currentTime + i * 3;
          masterGain.gain.setTargetAtTime(0.15, t, 0.01);
          masterGain.gain.setTargetAtTime(0, t + 0.4, 0.01);
          masterGain.gain.setTargetAtTime(0.15, t + 0.6, 0.01);
          masterGain.gain.setTargetAtTime(0, t + 1.0, 0.01);
        }
      } else if (ringtone === 'modern') {
        // Modern: square/sawtooth trill
        osc.type = 'square';
        masterGain.gain.setValueAtTime(0.05, ctx.currentTime);
        
        for (let i = 0; i < 40; i++) {
          const t = ctx.currentTime + i * 0.5;
          osc.frequency.setValueAtTime(800, t);
          osc.frequency.setValueAtTime(1000, t + 0.1);
          osc.frequency.setValueAtTime(1200, t + 0.2);
          osc.frequency.setValueAtTime(0, t + 0.3); // silence
        }
      } else {
        // Default: solid continuous tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        masterGain.gain.setValueAtTime(0.15, ctx.currentTime);
      }

      osc.connect(masterGain);
      osc.start();
      ringOscRef.current = osc;

      // Vibrate phone if browser supports it
      if (navigator.vibrate) {
        navigator.vibrate([400, 800, 400, 800, 400, 800]);
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
    if (customAudioRef.current) {
      customAudioRef.current.pause();
      customAudioRef.current.currentTime = 0;
      customAudioRef.current = null;
    }
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
