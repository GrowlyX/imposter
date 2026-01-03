import Redis from 'ioredis';
import { config } from '../config.js';
import type { ChatMessage, RoomData } from '../types/index.js';

export const redis = new Redis(config.redisUrl);

const ROOM_PREFIX = 'room:';
const ROOM_CODE_INDEX = 'room_codes';
const CHAT_PREFIX = 'chat:';

export async function saveRoom(room: RoomData): Promise<void> {
    await redis.set(`${ROOM_PREFIX}${room.id}`, JSON.stringify(room));
    await redis.hset(ROOM_CODE_INDEX, room.code, room.id);
    // Set TTL of 24 hours
    await redis.expire(`${ROOM_PREFIX}${room.id}`, 86400);
}

export async function getRoomById(id: string): Promise<RoomData | null> {
    const data = await redis.get(`${ROOM_PREFIX}${id}`);
    return data ? JSON.parse(data) : null;
}

export async function getRoomByCode(code: string): Promise<RoomData | null> {
    const id = await redis.hget(ROOM_CODE_INDEX, code);
    if (!id) return null;
    return getRoomById(id);
}

export async function deleteRoom(room: RoomData): Promise<void> {
    await redis.del(`${ROOM_PREFIX}${room.id}`);
    await redis.hdel(ROOM_CODE_INDEX, room.code);
    await redis.del(`${CHAT_PREFIX}${room.id}`);
}

export function generateRoomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Chat history functions (Redis-backed for horizontal scaling)
const MAX_CHAT_HISTORY = 100;

export async function saveChatMessage(roomId: string, message: ChatMessage): Promise<void> {
    const key = `${CHAT_PREFIX}${roomId}`;
    await redis.rpush(key, JSON.stringify(message));
    // Trim to last 100 messages
    await redis.ltrim(key, -MAX_CHAT_HISTORY, -1);
    // Set TTL to match room TTL
    await redis.expire(key, 86400);
}

export async function getChatHistory(roomId: string): Promise<ChatMessage[]> {
    const key = `${CHAT_PREFIX}${roomId}`;
    const messages = await redis.lrange(key, 0, -1);
    return messages.map((m) => JSON.parse(m));
}

// Meeting ID storage (Redis-backed for horizontal scaling)
const MEETING_PREFIX = 'meeting:';

// Returns true if saved, false if meeting already exists
export async function saveMeetingIdIfNotExists(
    roomId: string,
    meetingId: string
): Promise<boolean> {
    const key = `${MEETING_PREFIX}${roomId}`;
    // Use SETNX (set if not exists) to prevent race conditions
    const result = await redis.setnx(key, meetingId);
    if (result === 1) {
        // We set it, now add TTL
        await redis.expire(key, 86400); // 24 hour TTL
        return true;
    }
    return false;
}

export async function getMeetingId(roomId: string): Promise<string | null> {
    const key = `${MEETING_PREFIX}${roomId}`;
    return redis.get(key);
}

// For cleanup - delete meeting when room ends
export async function deleteMeetingId(roomId: string): Promise<void> {
    const key = `${MEETING_PREFIX}${roomId}`;
    await redis.del(key);
}

// Typing indicator storage (Redis-backed with TTL auto-expire)
const TYPING_PREFIX = 'typing:';
const TYPING_TTL_SECONDS = 3;

export interface TypingPlayer {
    playerId: string;
    playerName: string;
}

export async function setPlayerTyping(roomId: string, player: TypingPlayer): Promise<void> {
    const key = `${TYPING_PREFIX}${roomId}`;
    await redis.hset(key, player.playerId, JSON.stringify(player));
    await redis.expire(key, TYPING_TTL_SECONDS);
}

export async function removePlayerTyping(roomId: string, playerId: string): Promise<void> {
    const key = `${TYPING_PREFIX}${roomId}`;
    await redis.hdel(key, playerId);
}

export async function getTypingPlayers(roomId: string): Promise<TypingPlayer[]> {
    const key = `${TYPING_PREFIX}${roomId}`;
    const data = await redis.hgetall(key);
    return Object.values(data).map((v) => JSON.parse(v));
}

// Get all room IDs for reconciler cleanup
export async function getAllRoomIds(): Promise<string[]> {
    const roomIds: string[] = [];
    let cursor = '0';
    do {
        const result = await redis.scan(cursor, 'MATCH', `${ROOM_PREFIX}*`, 'COUNT', 100);
        cursor = result[0];
        for (const key of result[1]) {
            roomIds.push(key.replace(ROOM_PREFIX, ''));
        }
    } while (cursor !== '0');
    return roomIds;
}

// Update player connection status
export async function updatePlayerConnection(
    roomId: string,
    playerId: string,
    isConnected: boolean
): Promise<void> {
    const room = await getRoomById(roomId);
    if (!room) return;

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
        player.isConnected = isConnected;
        await saveRoom(room);
    }
}

