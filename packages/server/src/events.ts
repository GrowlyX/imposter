import { EventEmitter } from 'events';
import type { ChatMessage, GameState, RoomData } from './types/index.js';

// Type-safe event emitter for room updates
class RoomEventEmitter {
    private emitter = new EventEmitter();

    emit(roomId: string, room: RoomData): void {
        this.emitter.emit(roomId, room);
    }

    on(roomId: string, handler: (room: RoomData) => void): void {
        this.emitter.on(roomId, handler);
    }

    off(roomId: string, handler: (room: RoomData) => void): void {
        this.emitter.off(roomId, handler);
    }
}

// Type-safe event emitter for game state updates
class GameEventEmitter {
    private emitter = new EventEmitter();

    emit(roomId: string, state: GameState): void {
        this.emitter.emit(roomId, state);
    }

    on(roomId: string, handler: (state: GameState) => void): void {
        this.emitter.on(roomId, handler);
    }

    off(roomId: string, handler: (state: GameState) => void): void {
        this.emitter.off(roomId, handler);
    }
}

// Type-safe event emitter for chat messages
class ChatEventEmitter {
    private emitter = new EventEmitter();

    emit(roomId: string, message: ChatMessage): void {
        this.emitter.emit(roomId, message);
    }

    on(roomId: string, handler: (message: ChatMessage) => void): void {
        this.emitter.on(roomId, handler);
    }

    off(roomId: string, handler: (message: ChatMessage) => void): void {
        this.emitter.off(roomId, handler);
    }
}

export const roomEvents = new RoomEventEmitter();
export const gameEvents = new GameEventEmitter();
export const chatEvents = new ChatEventEmitter();
