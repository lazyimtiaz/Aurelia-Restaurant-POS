import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { MotionConfig } from 'motion/react';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Aurelia Dining Group POS';

createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx', { eager: true }) as Record<
            string,
            { default: React.ComponentType }
        >;
        const page = pages[`./pages/${name}.tsx`];
        if (!page) {
            throw new Error(`Inertia page not found: ./pages/${name}.tsx`);
        }
        return page;
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <MotionConfig reducedMotion="user">
                <App {...props} />
            </MotionConfig>,
        );
    },
    progress: {
        color: '#EA580C',
    },
});
