import { useState } from 'react';
import { Coffee, Cookie, Flame, Salad } from 'lucide-react';

interface DishThumbnailProps {
    imagePath: string | null | undefined;
    name: string;
    station: 'grill' | 'cold_salad' | 'pastry' | 'bar';
    className?: string;
}

const STATION_STYLES: Record<
    DishThumbnailProps['station'],
    { bg: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
    grill: { bg: 'from-orange-100 to-amber-50', iconColor: 'text-orange-600', Icon: Flame },
    cold_salad: { bg: 'from-emerald-100 to-lime-50', iconColor: 'text-emerald-600', Icon: Salad },
    pastry: { bg: 'from-amber-100 to-yellow-50', iconColor: 'text-amber-700', Icon: Cookie },
    bar: { bg: 'from-sky-100 to-indigo-50', iconColor: 'text-sky-600', Icon: Coffee },
};

export function DishThumbnail({
    imagePath,
    name,
    station,
    className = 'h-36 w-full',
}: DishThumbnailProps) {
    const [imgError, setImgError] = useState(false);
    const fallback = STATION_STYLES[station] ?? STATION_STYLES.grill;
    const Icon = fallback.Icon;

    if (imagePath && !imgError) {
        return (
            <div className={`overflow-hidden rounded-xl bg-muted ${className}`}>
                <img
                    src={imagePath}
                    alt={name}
                    loading="lazy"
                    onError={() => setImgError(true)}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            </div>
        );
    }

    return (
        <div
            className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${fallback.bg} ${className}`}
            aria-label={name}
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow-xs">
                <Icon className={`h-6 w-6 ${fallback.iconColor}`} />
            </div>
        </div>
    );
}
