import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws';
import superjson from 'superjson';

export interface Context {
    playerId: string | null;
    roomId: string | null;
}

export function createContext(
    opts: CreateExpressContextOptions | CreateWSSContextFnOptions
): Context {
    // Extract player and room IDs from headers or query params
    const req = 'req' in opts ? opts.req : opts.req;
    const playerId = (req.headers['x-player-id'] as string) || null;
    const roomId = (req.headers['x-room-id'] as string) || null;

    return { playerId, roomId };
}

const t = initTRPC.context<Context>().create({
    transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Middleware to ensure player is identified
export const authedProcedure = t.procedure.use(
    middleware(async ({ ctx, next }) => {
        if (!ctx.playerId) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Player ID required',
            });
        }
        return next({
            ctx: {
                ...ctx,
                playerId: ctx.playerId,
            },
        });
    })
);
