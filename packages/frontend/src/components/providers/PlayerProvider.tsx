'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PlayerContextType {
    playerId: string | null;
    playerName: string | null;
    roomId: string | null;
    roomCode: string | null;
    serverId: string | null;
    setPlayer: (playerId: string, playerName: string) => void;
    setRoom: (roomId: string, roomCode: string, serverId: string) => void;
    clearSession: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const STORAGE_KEYS = {
    PLAYER_ID: 'imposter_player_id',
    PLAYER_NAME: 'imposter_player_name',
    ROOM_ID: 'imposter_room_id',
    ROOM_CODE: 'imposter_room_code',
    SERVER_ID: 'imposter_server_id',
};

export function PlayerProvider({ children }: { children: ReactNode }) {
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState<string | null>(null);
    const [roomId, setRoomIdState] = useState<string | null>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [serverId, setServerId] = useState<string | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        setPlayerId(localStorage.getItem(STORAGE_KEYS.PLAYER_ID));
        setPlayerName(localStorage.getItem(STORAGE_KEYS.PLAYER_NAME));
        setRoomIdState(localStorage.getItem(STORAGE_KEYS.ROOM_ID));
        setRoomCode(localStorage.getItem(STORAGE_KEYS.ROOM_CODE));
        setServerId(localStorage.getItem(STORAGE_KEYS.SERVER_ID));
    }, []);

    const setPlayer = (id: string, name: string) => {
        setPlayerId(id);
        setPlayerName(name);
        localStorage.setItem(STORAGE_KEYS.PLAYER_ID, id);
        localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
    };

    const setRoom = (id: string, code: string, server: string) => {
        setRoomIdState(id);
        setRoomCode(code);
        setServerId(server);
        localStorage.setItem(STORAGE_KEYS.ROOM_ID, id);
        localStorage.setItem(STORAGE_KEYS.ROOM_CODE, code);
        localStorage.setItem(STORAGE_KEYS.SERVER_ID, server);
    };

    const clearSession = () => {
        setPlayerId(null);
        setPlayerName(null);
        setRoomIdState(null);
        setRoomCode(null);
        setServerId(null);
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    };

    return (
        <PlayerContext.Provider value={{
            playerId,
            playerName,
            roomId,
            roomCode,
            serverId,
            setPlayer,
            setRoom,
            clearSession,
        }}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (context === undefined) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
}
