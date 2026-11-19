import { useState } from 'react';
import { DishArtwork } from '@/design-system/DishArtwork';
import { cn } from '@/lib/utils';

interface DishThumbnailProps {
    imagePath: string | null | undefined;
    name: string;
    station: 'grill' | 'cold_salad' | 'pastry' | 'bar';
    slug?: string | null;
    className?: string;
}

export function DishThumbnail({
    imagePath,
    name,
    station,
    slug,
    className = 'aspect-[16/10] w-full',
}: DishThumbnailProps) {
    const [imgError, setImgError] = useState(false);

    const mappedStation = station === 'cold_salad' ? 'cold' : station;

    if (imagePath && !imgError) {
        return (
            <div className={cn('relative overflow-hidden rounded-xl bg-[var(--surface-inset)]', className)}>
                <img
                    src={imagePath}
                    alt={name}
                    decoding="async"
                    onError={() => setImgError(true)}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            </div>
        );
    }

    return (
        <div className={cn('overflow-hidden rounded-xl', className)} aria-label={name}>
            <DishArtwork slug={slug} prepStation={mappedStation} />
        </div>
    );
}
