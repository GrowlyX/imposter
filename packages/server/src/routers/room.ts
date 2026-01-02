import { z } from 'zod';
import { router, publicProcedure, authedProcedure } from '../trpc.js';
import { generateRoomCode, saveRoom, getRoomByCode, getRoomById } from '../lib/redis.js';
import { config } from '../config.js';
import { nanoid } from 'nanoid';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { roomEvents } from '../events.js';
import {
    type RoomData,
    defaultGameSettings,
    gameSettingsSchema
} from '../types/index.js';

export const roomRouter = router({
    // Create a new room
    create: publicProcedure
        .input(z.object({
            playerName: z.string().min(1).max(30),
        }))
        .mutation(async ({ input }) => {
            const roomId = nanoid();
            const playerId = nanoid();
            const code = generateRoomCode();

            const room: RoomData = {
                id: roomId,
                code,
                hostId: playerId,
                serverId: config.serverId,
                players: [
                    {
                        id: playerId,
                        name: input.playerName,
                        isHost: true,
                        isConnected: true,
                        joinedAt: Date.now(),
                    },
                ],
                settings: defaultGameSettings,
                state: 'lobby',
                gameState: null,
                createdAt: Date.now(),
            };

            await saveRoom(room);

            return {
                roomId,
                roomCode: code,
                playerId,
                serverId: config.serverId,
                shareUrl: `/room/${code}`,
            };
        }),

    // Join an existing room
    join: publicProcedure
        .input(z.object({
            code: z.string().length(6),
            playerName: z.string().min(1).max(30),
        }))
        .mutation(async ({ input }) => {
            const room = await getRoomByCode(input.code);

            if (!room) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Room not found',
                });
            }

            if (room.state !== 'lobby') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Game already in progress',
                });
            }

            const playerId = nanoid();
            room.players.push({
                id: playerId,
                name: input.playerName,
                isHost: false,
                isConnected: true,
                joinedAt: Date.now(),
            });

            await saveRoom(room);
            roomEvents.emit(room.id, room);

            return {
                roomId: room.id,
                roomCode: room.code,
                playerId,
                serverId: room.serverId, // Return originating server for load balancer affinity
            };
        }),

    // Get room state
    getState: publicProcedure
        .input(z.object({
            roomId: z.string(),
        }))
        .query(async ({ input }) => {
            const room = await getRoomById(input.roomId);

            if (!room) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Room not found',
                });
            }

            return room;
        }),

    // Update game settings (host only)
    updateSettings: authedProcedure
        .input(z.object({
            roomId: z.string(),
            settings: gameSettingsSchema.partial(),
        }))
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Room not found',
                });
            }

            if (room.hostId !== ctx.playerId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Only the host can update settings',
                });
            }

            // Validate imposter count
            const playerCount = room.players.filter((p) => p.isConnected).length;
            const newImposterCount = input.settings.imposterCount ?? room.settings.imposterCount;
            if (newImposterCount >= playerCount) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Imposter count must be less than player count',
                });
            }

            room.settings = {
                ...room.settings,
                ...input.settings,
            };

            await saveRoom(room);
            roomEvents.emit(room.id, room);

            return room;
        }),

    // Subscribe to room updates
    onUpdate: publicProcedure
        .input(z.object({
            roomId: z.string(),
        }))
        .subscription(({ input }) => {
            return observable<RoomData>((emit) => {
                const handler = (room: RoomData) => {
                    emit.next(room);
                };

                roomEvents.on(input.roomId, handler);

                return () => {
                    roomEvents.off(input.roomId, handler);
                };
            });
        }),
});
