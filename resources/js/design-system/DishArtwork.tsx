import * as React from 'react';
import { cn } from '@/lib/utils';

interface DishArtworkProps {
    slug?: string | null;
    prepStation?: 'grill' | 'cold' | 'pastry' | 'bar' | string | null;
    className?: string;
}

export function DishArtwork({ slug, prepStation, className }: DishArtworkProps) {
    const key = slug ?? prepStation ?? 'grill';

    if (key === 'wagyu-smash-burger') {
        return (
            <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#FBF4EA] via-[#F7E7D2] to-[#F2D5B3]', className)}>
                <svg viewBox="0 0 240 150" className="h-full w-full" fill="none" aria-hidden="true">
                    <circle cx="196" cy="28" r="46" fill="#EA580C" fillOpacity="0.08" />
                    <circle cx="42" cy="126" r="52" fill="#D97706" fillOpacity="0.08" />
                    {/* Plate */}
                    <ellipse cx="120" cy="118" rx="76" ry="16" fill="#FFFFFF" fillOpacity="0.9" stroke="#E2D2BC" strokeWidth="2" />
                    {/* Bottom bun */}
                    <path d="M70 100C70 95 75 92 84 92H156C165 92 170 95 170 100V106C170 112 162 115 120 115C78 115 70 112 70 106V100Z" fill="#D98B48" />
                    {/* Wagyu patty */}
                    <rect x="65" y="79" width="110" height="16" rx="8" fill="#592F22" />
                    {/* Aged cheddar melt */}
                    <path d="M68 79L86 90L104 79L122 92L142 79L160 89L173 79H68Z" fill="#F59E0B" />
                    {/* Crisp lettuce */}
                    <path d="M66 74C74 68 84 76 94 70C104 65 114 75 124 70C134 65 144 75 154 70C162 67 170 73 175 76" stroke="#16A34A" strokeWidth="6" strokeLinecap="round" />
                    {/* Brioche crown */}
                    <path d="M72 70C72 44 92 32 120 32C148 32 168 44 168 70H72Z" fill="#E69B56" />
                    <path d="M84 56C90 42 104 37 120 37" stroke="#F6C591" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
                    {/* Sesame seeds */}
                    <ellipse cx="102" cy="48" rx="3" ry="1.6" fill="#FFF8EB" transform="rotate(-18 102 48)" />
                    <ellipse cx="124" cy="44" rx="3" ry="1.6" fill="#FFF8EB" transform="rotate(12 124 44)" />
                    <ellipse cx="141" cy="52" rx="3" ry="1.6" fill="#FFF8EB" transform="rotate(24 141 52)" />
                </svg>
            </div>
        );
    }

    if (key === 'charred-prime-ribeye') {
        return (
            <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#F9F2EC] via-[#F2E2D7] to-[#E9CEBD]', className)}>
                <svg viewBox="0 0 240 150" className="h-full w-full" fill="none" aria-hidden="true">
                    <circle cx="48" cy="30" r="42" fill="#9A3412" fillOpacity="0.08" />
                    {/* Ceramic dinner plate */}
                    <ellipse cx="120" cy="88" rx="84" ry="44" fill="#FFFFFF" stroke="#DFCFC1" strokeWidth="2" />
                    <ellipse cx="120" cy="88" rx="68" ry="33" stroke="#EFE6DC" strokeWidth="1.5" />
                    {/* Charred ribeye silhouette */}
                    <path
                        d="M72 86C70 67 90 58 118 60C144 62 168 70 165 89C162 105 138 110 108 108C85 106 74 99 72 86Z"
                        fill="#6D3224"
                    />
                    {/* Grill sear marks */}
                    <path d="M88 70L106 96M108 65L128 97M128 67L146 95" stroke="#3E1911" strokeWidth="4" strokeLinecap="round" opacity="0.65" />
                    {/* Herb butter pat */}
                    <circle cx="118" cy="81" r="10" fill="#FBBF24" />
                    <circle cx="115" cy="79" r="2" fill="#15803D" />
                    <circle cx="121" cy="83" r="1.8" fill="#15803D" />
                    {/* Rosemary sprig */}
                    <path d="M148 102C160 95 168 85 174 72" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M156 97L152 89M163 90L159 82M169 82L165 74" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            </div>
        );
    }

    if (key === 'lobster-thermidor') {
        return (
            <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#FBF6EE] via-[#F9E8D9] to-[#F3D5BE]', className)}>
                <svg viewBox="0 0 240 150" className="h-full w-full" fill="none" aria-hidden="true">
                    <circle cx="195" cy="122" r="48" fill="#EA580C" fillOpacity="0.09" />
                    <ellipse cx="120" cy="88" rx="86" ry="44" fill="#FFFFFF" stroke="#E5D6C7" strokeWidth="2" />
                    {/* Split lobster shell */}
                    <path d="M64 88C68 68 94 58 130 60C156 62 174 72 176 86C164 102 138 108 104 106C82 104 68 98 64 88Z" fill="#DC4C2A" />
                    {/* Thermidor gratin glaze */}
                    <path d="M84 84C88 73 108 68 134 70C150 71 160 77 160 85C154 93 134 97 108 96C92 95 85 90 84 84Z" fill="#FDE68A" />
                    <path d="M98 80C112 76 130 77 146 82" stroke="#D97706" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
                    {/* Tail fan */}
                    <path d="M168 82L186 74L184 88L188 99L168 92Z" fill="#B91C1C" />
                    {/* Lemon wedge */}
                    <path d="M66 104C66 94 76 88 86 90L76 108C71 108 66 106 66 104Z" fill="#FACC15" />
                </svg>
            </div>
        );
    }

    if (key === 'yuzu-elderflower-spritz' || prepStation === 'bar') {
        return (
            <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#FBF8EE] via-[#FDF0CA] to-[#F7DF9C]', className)}>
                <svg viewBox="0 0 240 150" className="h-full w-full" fill="none" aria-hidden="true">
                    <circle cx="52" cy="36" r="44" fill="#F59E0B" fillOpacity="0.12" />
                    {/* Cocktail stemware */}
                    <path d="M90 36H150L142 82C139 95 130 102 120 102C110 102 101 95 98 82L90 36Z" fill="#FFFFFF" fillOpacity="0.72" stroke="#D6C4A4" strokeWidth="2" />
                    {/* Golden yuzu elixir */}
                    <path d="M95 56H145L140 81C137 92 129 98 120 98C111 98 103 92 100 81L95 56Z" fill="#FBBF24" fillOpacity="0.75" />
                    {/* Citrus wheel */}
                    <circle cx="144" cy="44" r="14" fill="#FACC15" stroke="#CA8A04" strokeWidth="2" />
                    <circle cx="144" cy="44" r="9" fill="#FEF08A" />
                    {/* Effervescent bubbles */}
                    <circle cx="110" cy="70" r="2.5" fill="#FFFFFF" opacity="0.85" />
                    <circle cx="126" cy="64" r="2" fill="#FFFFFF" opacity="0.85" />
                    <circle cx="118" cy="82" r="2.2" fill="#FFFFFF" opacity="0.85" />
                    {/* Stem & base */}
                    <line x1="120" y1="102" x2="120" y2="128" stroke="#D6C4A4" strokeWidth="2.5" />
                    <ellipse cx="120" cy="130" rx="22" ry="5" fill="#FFFFFF" stroke="#D6C4A4" strokeWidth="2" />
                </svg>
            </div>
        );
    }

    if (prepStation === 'pastry') {
        return (
            <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#FBF4F4] via-[#F4E1E1] to-[#EBD0D0]', className)}>
                <svg viewBox="0 0 240 150" className="h-full w-full" fill="none" aria-hidden="true">
                    <ellipse cx="120" cy="108" rx="76" ry="20" fill="#FFFFFF" stroke="#DFC8C8" strokeWidth="2" />
                    <path d="M84 96C84 68 100 54 120 54C140 54 156 68 156 96C156 102 140 106 120 106C100 106 84 102 84 96Z" fill="#4A2721" />
                    <path d="M106 58C109 70 118 76 128 70C134 67 137 61 139 56" fill="#2A120E" />
                    <circle cx="120" cy="46" r="8" fill="#E11D48" />
                </svg>
            </div>
        );
    }

    // Default cold / pantry architectural bowl illustration
    return (
        <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-[#F4F8F4] via-[#E4EFE4] to-[#D4E4D4]', className)}>
            <svg viewBox="0 0 240 150" className="h-full w-full" fill="none" aria-hidden="true">
                <circle cx="120" cy="78" r="52" fill="#FFFFFF" stroke="#CADAC9" strokeWidth="2" />
                <circle cx="120" cy="78" r="40" fill="#ECFDF5" />
                <circle cx="108" cy="70" r="14" fill="#22C55E" fillOpacity="0.65" />
                <circle cx="132" cy="74" r="12" fill="#16A34A" fillOpacity="0.55" />
                <circle cx="118" cy="86" r="15" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1.5" />
                <circle cx="102" cy="88" r="7" fill="#E11D48" fillOpacity="0.85" />
                <circle cx="136" cy="90" r="6" fill="#FB923C" fillOpacity="0.9" />
            </svg>
        </div>
    );
}
