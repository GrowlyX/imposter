'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { trpcQuery, trpcMutation } from '@/lib/api';

interface Player {
    id: string;
    name: string;
    isHost: boolean;
    isConnected: boolean;
}

interface GameSettings {
    gameType: 'word' | 'question';
    imposterCount: number;
    discussionTimeSeconds: number;
    showCategoryToImposter: boolean;
    showHintToImposter: boolean;
    categories: string[];
}

interface RoomData {
    id: string;
    code: string;
    hostId: string;
    players: Player[];
    settings: GameSettings;
    state: string;
}

const CATEGORIES = ['Animals', 'Food', 'Movies', 'Sports', 'Countries'];

export default function LobbyPage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.code as string;

    const [room, setRoom] = useState<RoomData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);

    // Local state for settings editing
    const [editingSettings, setEditingSettings] = useState<Partial<GameSettings>>({});

    const playerId = typeof window !== 'undefined' ? localStorage.getItem('imposter_player_id') : null;
    const storedRoomId = typeof window !== 'undefined' ? localStorage.getItem('imposter_room_id') : null;

    const isHost = room?.hostId === playerId;

    useEffect(() => {
        // Check if user has session for this room
        const storedRoomCode = localStorage.getItem('imposter_room_code');
        if (!storedRoomId || storedRoomCode !== roomCode) {
            // No session - redirect to join page
            router.push(`/room/${roomCode}`);
            return;
        }

        const fetchRoom = async () => {
            try {
                const roomData = await trpcQuery<RoomData>('room.getState', { roomId: storedRoomId }, { 'x-player-id': playerId || '' });
                setRoom(roomData);

                // If game is in progress, redirect to game
                if (roomData?.state === 'playing') {
                    router.push(`/room/${roomCode}/game`);
                }
            } catch (error) {
                console.error('Failed to fetch room:', error);
                toast.error('Failed to load room');
                router.push('/');
            } finally {
                setIsLoading(false);
            }
        };

        fetchRoom();
        const interval = setInterval(fetchRoom, 3000);
        return () => clearInterval(interval);
    }, [storedRoomId, playerId, router, roomCode]);

    const handleStartGame = async () => {
        if (!storedRoomId || !playerId) return;

        setIsStarting(true);
        try {
            await trpcMutation('game.start', { roomId: storedRoomId }, { 'x-player-id': playerId });
            toast.success('Game started!');
            router.push(`/room/${roomCode}/game`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start game');
        } finally {
            setIsStarting(false);
        }
    };

    const handleUpdateSettings = async () => {
        if (!storedRoomId || !playerId || Object.keys(editingSettings).length === 0) return;

        try {
            await trpcMutation('room.updateSettings', { roomId: storedRoomId, settings: editingSettings }, { 'x-player-id': playerId });
            toast.success('Settings updated!');
            setShowSettingsDialog(false);
            setEditingSettings({});
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update settings');
        }
    };

    const copyRoomLink = () => {
        const url = `${window.location.origin}/room/${roomCode}`;
        navigator.clipboard.writeText(url);
        toast.success('Room link copied!');
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomCode);
        toast.success('Room code copied!');
    };

    if (isLoading) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-muted-foreground">Loading room...</p>
                </div>
            </main>
        );
    }

    if (!room) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Room Not Found</CardTitle>
                        <CardDescription>This room doesn&apos;t exist or has expired.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push('/')} className="w-full">
                            Go Home
                        </Button>
                    </CardContent>
                </Card>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 bg-gradient-to-br from-background via-background to-primary/5">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Game Lobby</h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            Room Code:
                            <button
                                onClick={copyRoomCode}
                                className="font-mono text-xl font-bold text-primary hover:underline cursor-pointer"
                            >
                                {roomCode}
                            </button>
                        </p>
                    </div>
                    <Button variant="outline" onClick={copyRoomLink}>
                        📋 Copy Invite Link
                    </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Players List */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                Players
                                <Badge variant="secondary">{room.players.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {room.players.map((player) => (
                                <div
                                    key={player.id}
                                    className={`flex items-center justify-between p-3 rounded-lg ${player.id === playerId ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${player.isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                                        <span className="font-medium">{player.name}</span>
                                        {player.id === playerId && (
                                            <Badge variant="outline" className="text-xs">You</Badge>
                                        )}
                                    </div>
                                    {player.isHost && (
                                        <Badge>Host</Badge>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Game Settings */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Game Settings</CardTitle>
                                    <CardDescription>
                                        {isHost ? 'Configure the game before starting' : 'Waiting for host to start'}
                                    </CardDescription>
                                </div>
                                {isHost && (
                                    <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">⚙️ Edit</Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Game Settings</DialogTitle>
                                                <DialogDescription>Configure the game options</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 pt-4">
                                                {/* Game Type */}
                                                <div>
                                                    <label className="text-sm font-medium">Game Type</label>
                                                    <div className="flex gap-2 mt-2">
                                                        <Button
                                                            variant={editingSettings.gameType === 'word' || (!editingSettings.gameType && room.settings.gameType === 'word') ? 'default' : 'outline'}
                                                            onClick={() => setEditingSettings({ ...editingSettings, gameType: 'word' })}
                                                            className="flex-1"
                                                        >
                                                            🎯 Word
                                                        </Button>
                                                        <Button
                                                            variant={editingSettings.gameType === 'question' || (!editingSettings.gameType && room.settings.gameType === 'question') ? 'default' : 'outline'}
                                                            onClick={() => setEditingSettings({ ...editingSettings, gameType: 'question' })}
                                                            className="flex-1"
                                                        >
                                                            ❓ Question
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Imposter Count */}
                                                <div>
                                                    <label className="text-sm font-medium">Number of Imposters</label>
                                                    <div className="flex gap-2 mt-2">
                                                        {[1, 2, 3].map((count) => (
                                                            <Button
                                                                key={count}
                                                                variant={
                                                                    editingSettings.imposterCount === count ||
                                                                        (!editingSettings.imposterCount && room.settings.imposterCount === count)
                                                                        ? 'default' : 'outline'
                                                                }
                                                                onClick={() => setEditingSettings({ ...editingSettings, imposterCount: count })}
                                                                className="flex-1"
                                                            >
                                                                {count}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Discussion Time */}
                                                <div>
                                                    <label className="text-sm font-medium">Discussion Time (seconds)</label>
                                                    <Input
                                                        type="number"
                                                        min={30}
                                                        max={600}
                                                        value={editingSettings.discussionTimeSeconds ?? room.settings.discussionTimeSeconds}
                                                        onChange={(e) => setEditingSettings({
                                                            ...editingSettings,
                                                            discussionTimeSeconds: parseInt(e.target.value) || 120
                                                        })}
                                                        className="mt-2"
                                                    />
                                                </div>

                                                {/* Categories */}
                                                <div>
                                                    <label className="text-sm font-medium">Categories</label>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {CATEGORIES.map((cat) => {
                                                            const currentCats = editingSettings.categories ?? room.settings.categories;
                                                            const isSelected = currentCats.includes(cat);
                                                            return (
                                                                <Button
                                                                    key={cat}
                                                                    variant={isSelected ? 'default' : 'outline'}
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        const newCats = isSelected
                                                                            ? currentCats.filter((c) => c !== cat)
                                                                            : [...currentCats, cat];
                                                                        if (newCats.length > 0) {
                                                                            setEditingSettings({ ...editingSettings, categories: newCats });
                                                                        }
                                                                    }}
                                                                >
                                                                    {cat}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <Button className="w-full" onClick={handleUpdateSettings}>
                                                    Save Settings
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-muted-foreground">Game Type</p>
                                    <p className="font-medium capitalize">{room.settings.gameType}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-muted-foreground">Imposters</p>
                                    <p className="font-medium">{room.settings.imposterCount}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-muted-foreground">Discussion Time</p>
                                    <p className="font-medium">{room.settings.discussionTimeSeconds}s</p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-muted-foreground">Show Category</p>
                                    <p className="font-medium">{room.settings.showCategoryToImposter ? 'Yes' : 'No'}</p>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <p className="text-sm text-muted-foreground mb-2">Categories</p>
                                <div className="flex flex-wrap gap-2">
                                    {room.settings.categories.map((cat) => (
                                        <Badge key={cat} variant="secondary">{cat}</Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Start Game Button (Host Only) */}
                {isHost && (
                    <Card className="border-primary/50">
                        <CardContent className="pt-6">
                            <Button
                                className="w-full"
                                size="lg"
                                onClick={handleStartGame}
                                disabled={isStarting || room.players.length < 2}
                            >
                                {isStarting ? 'Starting...' : room.players.length < 2 ? 'Need at least 2 players' : '🚀 Start Game'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {!isHost && (
                    <Card>
                        <CardContent className="pt-6 text-center">
                            <p className="text-muted-foreground">Waiting for host to start the game...</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
