import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface SlaTimerBadgeProps {
    firedAt: string;
}

export function SlaTimerBadge({ firedAt }: SlaTimerBadgeProps) {
    const [elapsedSec, setElapsedSec] = useState(() =>
        Math.max(0, Math.floor((Date.now() - new Date(firedAt).getTime()) / 1000)),
    );

    useEffect(() => {
        const timer = window.setInterval(() => {
            setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(firedAt).getTime()) / 1000)));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [firedAt]);

    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const toneClass =
        mins >= 15
            ? 'border-rose-500/50 bg-rose-500/20 text-rose-300 animate-pulse'
            : mins >= 10
              ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold ${toneClass}`}>
            <Clock className="h-3 w-3" />
            {formatted}
        </span>
    );
}
