import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { chatEvents, typingEvents } from '../events.js';
import {
    getChatHistory,
    getRoomById,
    getTypingPlayers,
    removePlayerTyping,
    saveChatMessage,
    setPlayerTyping,
} from '../lib/redis.js';
import { authedProcedure, router } from '../trpc.js';
import type { ChatMessage } from '../types/index.js';

export const chatRouter = router({
    // Send a chat message
    send: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
                content: z.string().min(1).max(512),
            })
        )
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
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .query(async ({ input }) => {
            return getChatHistory(input.roomId);
        }),

    // Subscribe to new messages
    onMessage: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
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

    // Start typing indicator
    startTyping: authedProcedure
        .input(z.object({ roomId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);
            if (!room) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
            }
            const player = room.players.find((p) => p.id === ctx.playerId);
            if (!player) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
            }

            await setPlayerTyping(input.roomId, { playerId: ctx.playerId, playerName: player.name });
            typingEvents.emit(input.roomId, {
                playerId: ctx.playerId,
                playerName: player.name,
                isTyping: true,
            });
        }),

    // Stop typing indicator
    stopTyping: authedProcedure
        .input(z.object({ roomId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            await removePlayerTyping(input.roomId, ctx.playerId);
            typingEvents.emit(input.roomId, {
                playerId: ctx.playerId,
                playerName: '',
                isTyping: false,
            });
        }),

    // Get current typing players
    getTyping: authedProcedure
        .input(z.object({ roomId: z.string() }))
        .query(async ({ input }) => {
            return getTypingPlayers(input.roomId);
        }),
});
