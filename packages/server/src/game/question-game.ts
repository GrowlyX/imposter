import type { GameState, RoomData } from '../types/index.js';
import { getRandomQuestionPair } from '../data/categories.js';

export interface QuestionGameResult {
    gameState: GameState;
    playerData: Map<string, PlayerQuestionData>;
}

export interface PlayerQuestionData {
    isImposter: boolean;
    question: string;
    category: string;
}

export function initializeQuestionGame(
    room: RoomData,
    settings: {
        imposterCount: number;
        showCategoryToImposter: boolean;
        answerTimeSeconds: number;
        discussionTimeSeconds: number;
    }
): QuestionGameResult {
    const players = room.players.filter((p) => p.isConnected);
    const playerIds = players.map((p) => p.id);

    // Select imposters randomly
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const imposterIds = new Set(shuffled.slice(0, settings.imposterCount));

    // Get a random question pair
    const { question1, question2, category } = getRandomQuestionPair(room.settings.categories);

    // Assign roles and questions
    const playerRoles: Record<string, 'player' | 'imposter'> = {};
    const playerData = new Map<string, PlayerQuestionData>();

    for (const playerId of playerIds) {
        const isImposter = imposterIds.has(playerId);
        playerRoles[playerId] = isImposter ? 'imposter' : 'player';

        playerData.set(playerId, {
            isImposter,
            question: isImposter ? question2 : question1,
            category: settings.showCategoryToImposter ? category : (isImposter ? '' : category),
        });
    }

    const now = Date.now();
    const gameState: GameState = {
        phase: 'answering',
        realQuestion: question1,
        imposterQuestion: question2,
        playerRoles,
        answers: {},
        phaseStartedAt: now,
        phaseEndsAt: now + settings.answerTimeSeconds * 1000,
    };

    return { gameState, playerData };
}

export function submitAnswer(
    gameState: GameState,
    playerId: string,
    answer: string
): GameState {
    return {
        ...gameState,
        answers: {
            ...gameState.answers,
            [playerId]: answer,
        },
    };
}

export function checkAllPlayersAnswered(
    gameState: GameState,
    playerCount: number
): boolean {
    return Object.keys(gameState.answers ?? {}).length >= playerCount;
}

export function startQuestionDiscussionPhase(
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

export function startQuestionRevealPhase(gameState: GameState): GameState {
    return {
        ...gameState,
        phase: 'reveal',
        phaseStartedAt: Date.now(),
        phaseEndsAt: undefined,
    };
}
