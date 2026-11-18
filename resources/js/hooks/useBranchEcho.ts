import { useEffect, useRef } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

export type BranchChannelSuffix = 'pos' | 'kds' | 'floor' | 'manager';

type EchoEventHandler = (eventName: string, payload: Record<string, unknown>) => void;

declare global {
    interface Window {
        Pusher?: typeof Pusher;
        __aureliaEcho?: Echo<'reverb'>;
    }
}

function getEchoClient(): Echo<'reverb'> | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const appKey = import.meta.env.VITE_REVERB_APP_KEY;
    if (!appKey) {
        return null;
    }

    if (!window.__aureliaEcho) {
        window.Pusher = Pusher;
        window.__aureliaEcho = new Echo({
            broadcaster: 'reverb',
            key: appKey,
            wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
            enabledTransports: ['ws', 'wss'],
        });
    }

    return window.__aureliaEcho;
}

const CHANNEL_EVENTS: Record<BranchChannelSuffix, string[]> = {
    kds: ['.OrderRoundFired', '.KitchenItemStatusUpdated', '.TicketExpoServed', '.OrderItemVoided'],
    pos: [
        '.TicketExpoServed',
        '.OrderBillSplitUpdated',
        '.PaymentCaptured',
        '.ItemAvailabilityChanged',
        '.OrderItemVoided',
        '.TableOccupancyChanged',
    ],
    floor: ['.TableOccupancyChanged', '.TicketExpoServed', '.ServiceRequested'],
    manager: ['.ShiftVarianceFlagged', '.CriticalAuditLogged', '.ItemAvailabilityChanged'],
};

export function useBranchEcho(
    branchId: number,
    channels: BranchChannelSuffix[],
    onEvent: EchoEventHandler,
) {
    const handlerRef = useRef(onEvent);
    handlerRef.current = onEvent;

    const channelKey = channels.join(',');

    useEffect(() => {
        const echo = getEchoClient();
        if (!echo || branchId <= 0) {
            return;
        }

        const subscribedNames: string[] = [];

        channels.forEach((suffix) => {
            const channelName = `branch.${branchId}.${suffix}`;
            subscribedNames.push(channelName);
            const channel = echo.private(channelName);

            CHANNEL_EVENTS[suffix].forEach((eventName) => {
                channel.listen(eventName, (payload: Record<string, unknown>) => {
                    handlerRef.current(eventName.replace(/^\./, ''), payload);
                });
            });
        });

        return () => {
            subscribedNames.forEach((channelName) => {
                echo.leave(channelName);
            });
        };
    }, [branchId, channelKey]);
}
