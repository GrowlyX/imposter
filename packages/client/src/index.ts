/**
 * @imposter/client - tRPC client for Imposter Game
 * 
 * Type-safe client using tRPC's recommended inference patterns.
 */

import { createTRPCClient, httpBatchLink, splitLink, unstable_httpSubscriptionLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@imposter/server/src/router.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

// Type inference helpers (tRPC recommended pattern)
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

// Inferred types for common operations
export type RoomCreateInput = RouterInput['room']['create'];
export type RoomCreateOutput = RouterOutput['room']['create'];
export type RoomJoinInput = RouterInput['room']['join'];
export type RoomJoinOutput = RouterOutput['room']['join'];
export type RoomData = RouterOutput['room']['getState'];
export type GameState = RoomData['gameState'];
export type Player = RoomData['players'][number];
export type GameSettings = RoomData['settings'];
export type ChatMessage = RouterOutput['chat']['send'];

// Client factory
export function createClient(options: {
    url: string;
    playerId?: string;
    roomId?: string;
}) {
    return createTRPCClient<AppRouter>({
        links: [
            splitLink({
                condition: (op) => op.type === 'subscription',
                true: unstable_httpSubscriptionLink({
                    url: options.url,
                    transformer: superjson,
                }),
                false: httpBatchLink({
                    url: options.url,
                    transformer: superjson,
                    headers: () => ({
                        'x-player-id': options.playerId ?? '',
                        'x-room-id': options.roomId ?? '',
                    }),
                }),
            }),
        ],
    });
}

// Re-export for convenience
export type { AppRouter };
