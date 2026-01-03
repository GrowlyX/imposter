import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { z } from 'zod';
import { gameEvents, roomEvents } from '../events.js';
import {
    checkAllPlayersAnswered,
    initializeQuestionGame,
    startQuestionDiscussionPhase,
    startQuestionRevealPhase,
    submitAnswer,
} from '../game/question-game.js';
import {
    checkAllPlayersConfirmed,
    initializeWordGame,
    startDiscussionPhase,
    startRevealPhase,
} from '../game/word-game.js';
import { getRoomById, saveRoom } from '../lib/redis.js';
import { authedProcedure, router } from '../trpc.js';
import type { GameState } from '../types/index.js';

// In-memory storage for player-specific game data (not shared with all players)
const playerGameData = new Map<string, Map<string, any>>();

export function getPlayerGameData(roomId: string, playerId: string): any {
    return playerGameData.get(roomId)?.get(playerId);
}

export const gameRouter = router({
    // Start the game (host only)
    start: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
            }

            if (room.hostId !== ctx.playerId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Only the host can start the game',
                });
            }

            if (room.state !== 'lobby') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Game already in progress' });
            }

            const playerCount = room.players.filter((p) => p.isConnected).length;
            if (playerCount < 2) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Need at least 2 players' });
            }

            if (room.settings.imposterCount >= playerCount) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Imposter count must be less than player count',
                });
            }

            // Initialize game based on type
            let gameState: GameState;
            const roomPlayerData = new Map<string, any>();

            if (room.settings.gameType === 'word') {
                const result = initializeWordGame(room, {
                    imposterCount: room.settings.imposterCount,
                    showCategoryToImposter: room.settings.showCategoryToImposter,
                    showHintToImposter: room.settings.showHintToImposter,
                    discussionTimeSeconds: room.settings.discussionTimeSeconds,
                });
                gameState = result.gameState;
                result.playerData.forEach((data, playerId) => {
                    roomPlayerData.set(playerId, data);
                });
            } else {
                const result = initializeQuestionGame(room, {
                    imposterCount: room.settings.imposterCount,
                    showCategoryToImposter: room.settings.showCategoryToImposter,
                    answerTimeSeconds: room.settings.answerTimeSeconds,
                    discussionTimeSeconds: room.settings.discussionTimeSeconds,
                });
                gameState = result.gameState;
                result.playerData.forEach((data, playerId) => {
                    roomPlayerData.set(playerId, data);
                });
            }

            playerGameData.set(room.id, roomPlayerData);
            room.gameState = gameState;
            room.state = 'playing';

            await saveRoom(room);
            roomEvents.emit(room.id, room);
            gameEvents.emit(room.id, gameState);

            return { success: true };
        }),

    // Get player's personal game data (word/question, role)
    getMyData: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .query(async ({ input, ctx }) => {
            const data = getPlayerGameData(input.roomId, ctx.playerId);
            if (!data) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'No game data found' });
            }
            return data;
        }),

    // Confirm player has seen their word (Word Game)
    confirmWord: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room || !room.gameState) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Game not found' });
            }

            if (room.gameState.phase !== 'confirming') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not in confirmation phase' });
            }

            if (!room.gameState.confirmedPlayers) {
                room.gameState.confirmedPlayers = [];
            }

            if (!room.gameState.confirmedPlayers.includes(ctx.playerId)) {
                room.gameState.confirmedPlayers.push(ctx.playerId);
            }

            const playerCount = room.players.filter((p) => p.isConnected).length;
            if (checkAllPlayersConfirmed(room.gameState, playerCount)) {
                room.gameState = startDiscussionPhase(
                    room.gameState,
                    room.settings.discussionTimeSeconds
                );
            }

            await saveRoom(room);
            gameEvents.emit(room.id, room.gameState);

            return { success: true };
        }),

    // Submit answer (Question Game)
    submitAnswer: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
                answer: z.string().min(1).max(500),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room || !room.gameState) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Game not found' });
            }

            if (room.gameState.phase !== 'answering') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not in answering phase' });
            }

            room.gameState = submitAnswer(room.gameState, ctx.playerId, input.answer);

            const playerCount = room.players.filter((p) => p.isConnected).length;
            if (checkAllPlayersAnswered(room.gameState, playerCount)) {
                room.gameState = startQuestionDiscussionPhase(
                    room.gameState,
                    room.settings.discussionTimeSeconds
                );
            }

            await saveRoom(room);
            gameEvents.emit(room.id, room.gameState);

            return { success: true };
        }),

    // Force reveal (host only, ends discussion early)
    forceReveal: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room || !room.gameState) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Game not found' });
            }

            if (room.hostId !== ctx.playerId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Only the host can force reveal',
                });
            }

            if (room.gameState.phase !== 'discussion') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not in discussion phase' });
            }

            if (room.settings.gameType === 'word') {
                room.gameState = startRevealPhase(room.gameState);
            } else {
                room.gameState = startQuestionRevealPhase(room.gameState);
            }

            await saveRoom(room);
            gameEvents.emit(room.id, room.gameState);

            return { success: true };
        }),

    // End game and return to lobby (host only)
    endGame: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
            }

            if (room.hostId !== ctx.playerId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Only the host can end the game',
                });
            }

            room.state = 'lobby';
            room.gameState = null;
            playerGameData.delete(room.id);

            await saveRoom(room);
            roomEvents.emit(room.id, room);

            return { success: true };
        }),

    // Subscribe to game state updates
    onStateChange: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .subscription(({ input }) => {
            return observable<GameState>((emit) => {
                const handler = (state: GameState) => {
                    emit.next(state);
                };

                gameEvents.on(input.roomId, handler);

                return () => {
                    gameEvents.off(input.roomId, handler);
                };
            });
        }),
});
