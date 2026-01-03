import { z } from 'zod';

// Player schema
export const playerSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(30),
    isHost: z.boolean(),
    isConnected: z.boolean(),
    joinedAt: z.number(),
});

export type Player = z.infer<typeof playerSchema>;

// Game settings schema
export const gameSettingsSchema = z.object({
    gameType: z.enum(['word', 'question']),
    categories: z.array(z.string()).min(1),
    imposterCount: z.number().int().min(1),
    showCategoryToImposter: z.boolean(),
    showHintToImposter: z.boolean(), // Word game only
    discussionTimeSeconds: z.number().int().min(30).max(600),
    answerTimeSeconds: z.number().int().min(30).max(300), // Question game only
});

export type GameSettings = z.infer<typeof gameSettingsSchema>;

// Room state
export const roomStateSchema = z.enum(['lobby', 'playing', 'finished']);
export type RoomState = z.infer<typeof roomStateSchema>;

// Game phase
export const gamePhaseSchema = z.enum([
    'assigning',
    'confirming',
    'answering',
    'discussion',
    'reveal',
]);
export type GamePhase = z.infer<typeof gamePhaseSchema>;

// Player role
export const playerRoleSchema = z.enum(['player', 'imposter']);
export type PlayerRole = z.infer<typeof playerRoleSchema>;

// Game state schema
export const gameStateSchema = z.object({
    phase: gamePhaseSchema,
    // Word game
    word: z.string().optional(),
    category: z.string().optional(),
    hint: z.string().optional(),
    playerRoles: z.record(z.string(), playerRoleSchema).optional(),
    confirmedPlayers: z.array(z.string()).optional(),
    // Question game
    realQuestion: z.string().optional(),
    imposterQuestion: z.string().optional(),
    answers: z.record(z.string(), z.string()).optional(),
    // Timing
    phaseStartedAt: z.number().optional(),
    phaseEndsAt: z.number().optional(),
});

export type GameState = z.infer<typeof gameStateSchema>;

// Room data schema
export const roomDataSchema = z.object({
    id: z.string(),
    code: z.string().length(6),
    hostId: z.string(),
    serverId: z.string(), // Server that created this room (for load balancer affinity)
    players: z.array(playerSchema),
    settings: gameSettingsSchema,
    state: roomStateSchema,
    gameState: gameStateSchema.nullable(),
    createdAt: z.number(),
});

export type RoomData = z.infer<typeof roomDataSchema>;

// Chat message schema
export const chatMessageSchema = z.object({
    id: z.string(),
    roomId: z.string(),
    playerId: z.string(),
    playerName: z.string(),
    content: z.string().min(1).max(500),
    timestamp: z.number(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Default settings
export const defaultGameSettings: GameSettings = {
    gameType: 'word',
    categories: ['Love & Relationships'],
    imposterCount: 1,
    showCategoryToImposter: true,
    showHintToImposter: false,
    discussionTimeSeconds: 180,
    answerTimeSeconds: 60,
};
