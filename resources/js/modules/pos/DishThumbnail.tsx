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
    const [imgLoaded, setImgLoaded] = useState(false);

    const mappedStation = station === 'cold_salad' ? 'cold' : station;

    if (imagePath && !imgError) {
        return (
            <div className={cn('relative overflow-hidden rounded-xl bg-[var(--surface-inset)]', className)}>
                {!imgLoaded && (
                    <div className="absolute inset-0">
                        <DishArtwork slug={slug} prepStation={mappedStation} />
                    </div>
                )}
                <img
                    src={imagePath}
                    alt={name}
                    loading="lazy"
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                    className={cn(
                        'h-full w-full object-cover transition-all duration-300 group-hover:scale-105',
                        imgLoaded ? 'opacity-100' : 'opacity-0',
                    )}
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
