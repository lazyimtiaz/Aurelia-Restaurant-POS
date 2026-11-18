import { useCallback, useRef, useState } from 'react';

export function useKdsAudioAlert() {
    const [muted, setMuted] = useState(false);
    const ctxRef = useRef<AudioContext | null>(null);

    const playChime = useCallback(
        (kind: 'ticket' | 'sla' = 'ticket') => {
            if (muted || typeof window === 'undefined') {
                return;
            }

            try {
                const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioCtx) {
                    return;
                }
                if (!ctxRef.current) {
                    ctxRef.current = new AudioCtx();
                }

                const ctx = ctxRef.current;
                const now = ctx.currentTime;
                const notes = kind === 'sla' ? [880, 660, 880] : [587.33, 880];

                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.11);
                    gain.gain.setValueAtTime(0.08, now + idx * 0.11);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.18);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + idx * 0.11);
                    osc.stop(now + idx * 0.11 + 0.19);
                });
            } catch {
                // Ignore browser autoplay block prior to user interaction
            }
        },
        [muted],
    );

    return { muted, setMuted, playChime };
}
