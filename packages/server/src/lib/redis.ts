import Redis from 'ioredis';
import { config } from '../config.js';
import type { RoomData, ChatMessage } from '../types/index.js';

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
export async function saveMeetingIdIfNotExists(roomId: string, meetingId: string): Promise<boolean> {
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
