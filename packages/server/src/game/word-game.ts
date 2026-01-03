import { getRandomWord } from '../data/categories.js';
import type { GameState, RoomData } from '../types/index.js';

export interface WordGameResult {
    gameState: GameState;
    playerData: Map<string, PlayerWordData>;
}

export interface PlayerWordData {
    isImposter: boolean;
    word: string | null;
    hint: string | null;
    category: string | null;
}

export function initializeWordGame(
    room: RoomData,
    settings: {
        imposterCount: number;
        showCategoryToImposter: boolean;
        showHintToImposter: boolean;
        discussionTimeSeconds: number;
    }
): WordGameResult {
    const players = room.players.filter((p) => p.isConnected);
    const playerIds = players.map((p) => p.id);

    // Select imposters randomly
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const imposterIds = new Set(shuffled.slice(0, settings.imposterCount));

    // Get a random word
    const { word, hint, category } = getRandomWord(room.settings.categories);

    // Assign roles
    const playerRoles: Record<string, 'player' | 'imposter'> = {};
    const playerData = new Map<string, PlayerWordData>();

    for (const playerId of playerIds) {
        const isImposter = imposterIds.has(playerId);
        playerRoles[playerId] = isImposter ? 'imposter' : 'player';

        playerData.set(playerId, {
            isImposter,
            word: isImposter ? null : word,
            hint: isImposter && settings.showHintToImposter ? hint : null,
            category:
                isImposter && settings.showCategoryToImposter
                    ? category
                    : isImposter
                      ? null
                      : category,
        });
    }

    const gameState: GameState = {
        phase: 'confirming',
        word,
        category,
        hint,
        playerRoles,
        confirmedPlayers: [],
        phaseStartedAt: Date.now(),
    };

    return { gameState, playerData };
}

export function checkAllPlayersConfirmed(gameState: GameState, playerCount: number): boolean {
    return (gameState.confirmedPlayers?.length ?? 0) >= playerCount;
}

export function startDiscussionPhase(
    gameState: GameState,
    discussionTimeSeconds: number
): GameState {
    return {
        ...gameState,
        phase: 'discussion',
        phaseStartedAt: Date.now(),
        phaseEndsAt: Date.now() + discussionTimeSeconds * 1000,
    };
}

export function startRevealPhase(gameState: GameState): GameState {
    return {
        ...gameState,
        phase: 'reveal',
        phaseStartedAt: Date.now(),
        phaseEndsAt: undefined,
    };
}
