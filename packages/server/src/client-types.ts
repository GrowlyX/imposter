// Re-export types from server for client usage
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from './router.js';

export type { AppRouter };
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

// Room types
export type RoomCreateInput = RouterInput['room']['create'];
export type RoomCreateOutput = RouterOutput['room']['create'];
export type RoomJoinInput = RouterInput['room']['join'];
export type RoomJoinOutput = RouterOutput['room']['join'];
export type RoomGetStateInput = RouterInput['room']['getState'];
export type RoomData = RouterOutput['room']['getState'];

// Game types
export type GameStartInput = RouterInput['game']['start'];
export type GameStartOutput = RouterOutput['game']['start'];

// Chat types
export type ChatSendInput = RouterInput['chat']['send'];
export type ChatMessage = RouterOutput['chat']['send'];

// Re-export Zod schemas and inferred types
export * from './types/index.js';
