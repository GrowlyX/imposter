import { z } from 'zod';
import { router, authedProcedure } from '../trpc.js';
import { getRoomById, saveChatMessage, getChatHistory } from '../lib/redis.js';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { chatEvents } from '../events.js';
import type { ChatMessage } from '../types/index.js';
import { nanoid } from 'nanoid';

export const chatRouter = router({
    // Send a chat message
    send: authedProcedure
        .input(z.object({
            roomId: z.string(),
            content: z.string().min(1).max(500),
        }))
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
            }

            const player = room.players.find((p) => p.id === ctx.playerId);
            if (!player) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
            }

            const message: ChatMessage = {
                id: nanoid(),
                roomId: input.roomId,
                playerId: ctx.playerId,
                playerName: player.name,
                content: input.content,
                timestamp: Date.now(),
            };

            // Store in Redis
            await saveChatMessage(input.roomId, message);

            // Emit to subscribers on this server instance
            chatEvents.emit(input.roomId, message);

            return message;
        }),

    // Get chat history
    getHistory: authedProcedure
        .input(z.object({
            roomId: z.string(),
        }))
        .query(async ({ input }) => {
            return getChatHistory(input.roomId);
        }),

    // Subscribe to new messages
    onMessage: authedProcedure
        .input(z.object({
            roomId: z.string(),
        }))
        .subscription(({ input }) => {
            return observable<ChatMessage>((emit) => {
                const handler = (message: ChatMessage) => {
                    emit.next(message);
                };

                chatEvents.on(input.roomId, handler);

                return () => {
                    chatEvents.off(input.roomId, handler);
                };
            });
        }),
});
