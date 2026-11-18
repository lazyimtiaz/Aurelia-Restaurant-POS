export function formatCents(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const dollars = Math.floor(abs / 100);
    const rem = abs % 100;

    return `${sign}$${dollars.toLocaleString('en-US')}.${String(rem).padStart(2, '0')}`;
}

export function formatBps(bps: number): string {
    const whole = Math.floor(bps / 100);
    const frac = bps % 100;

    if (frac === 0) {
        return `${whole}%`;
    }

    return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}%`;
}
