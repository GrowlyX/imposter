'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, splitLink, wsLink, createWSClient } from '@trpc/client';
import { trpc } from '@imposter/client';
import superjson from 'superjson';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

function getLinks(playerId?: string, roomId?: string) {
    const wsUrl = SERVER_URL.replace('http', 'ws');

    const wsClient = createWSClient({
        url: `${wsUrl}/trpc`,
    });

    return [
        splitLink({
            condition: (op) => op.type === 'subscription',
            true: wsLink({ client: wsClient }),
            false: httpBatchLink({
                url: `${SERVER_URL}/trpc`,
                headers: () => ({
                    'x-player-id': playerId ?? '',
                    'x-room-id': roomId ?? '',
                }),
                transformer: superjson,
            }),
        }),
    ];
}

export function TRPCProvider({
    children,
    playerId,
    roomId,
}: {
    children: React.ReactNode;
    playerId?: string;
    roomId?: string;
}) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 1000,
                refetchOnWindowFocus: false,
            },
        },
    }));

    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: getLinks(playerId, roomId),
        })
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
}
