import * as React from 'react';
import { cn } from '@/lib/utils';

interface AureliaMarkProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'brand' | 'dark' | 'light';
    className?: string;
}

const sizeClasses: Record<NonNullable<AureliaMarkProps['size']>, string> = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-12 w-12 rounded-2xl',
    xl: 'h-14 w-14 rounded-2xl',
};

export function AureliaMark({ size = 'md', variant = 'brand', className }: AureliaMarkProps) {
    const surface =
        variant === 'dark'
            ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-stone-950 shadow-[0_6px_18px_-6px_rgba(249,115,22,0.6)]'
            : variant === 'light'
              ? 'bg-card border border-border text-primary shadow-bistro-card'
              : 'bg-gradient-to-br from-[#EA580C] to-[#D97706] text-white shadow-[0_6px_18px_-6px_rgba(234,88,12,0.55)]';

    return (
        <span
            aria-hidden="true"
            className={cn(
                'relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none',
                sizeClasses[size],
                surface,
                className,
            )}
        >
            <svg viewBox="0 0 36 36" fill="none" className="h-[64%] w-[64%]">
                {/* Upper cloche finial */}
                <circle cx="18" cy="7.5" r="2.2" fill="currentColor" opacity="0.95" />
                {/* Editorial cloche dome arc */}
                <path
                    d="M7 22.5C7 15.873 11.925 10.5 18 10.5C24.075 10.5 29 15.873 29 22.5H7Z"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                />
                {/* Inner Aurelia arch highlight */}
                <path
                    d="M12.5 18.5C13.6 15.6 15.6 14 18 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.7"
                />
                {/* Serving tray base */}
                <path
                    d="M4.5 26.5H31.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
            </svg>
        </span>
    );
}
