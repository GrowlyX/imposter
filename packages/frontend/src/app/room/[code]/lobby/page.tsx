'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { trpcMutation, trpcQuery } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

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

interface ValidationErrors {
    discussionTime?: string;
    categories?: string;
}

const CATEGORIES = ['Animals', 'Food', 'Movies', 'Sports', 'Countries'];

export default function LobbyPage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.code as string;

    const [room, setRoom] = useState<RoomData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);

    // Local state for settings editing - using string for input to allow empty values
    const [editGameType, setEditGameType] = useState<'word' | 'question' | null>(null);
    const [editImposterCount, setEditImposterCount] = useState<number | null>(null);
    const [editDiscussionTime, setEditDiscussionTime] = useState<string>('');
    const [editCategories, setEditCategories] = useState<string[] | null>(null);
    const [errors, setErrors] = useState<ValidationErrors>({});

    const playerId =
        typeof window !== 'undefined' ? localStorage.getItem('imposter_player_id') : null;
    const storedRoomId =
        typeof window !== 'undefined' ? localStorage.getItem('imposter_room_id') : null;

    const isHost = room?.hostId === playerId;

    // Initialize editing values when dialog opens
    useEffect(() => {
        if (showSettingsDialog && room) {
            setEditGameType(null);
            setEditImposterCount(null);
            setEditDiscussionTime(room.settings.discussionTimeSeconds.toString());
            setEditCategories(null);
            setErrors({});
        }
    }, [showSettingsDialog, room]);

    // Validate discussion time
    const validateDiscussionTime = (value: string): string | undefined => {
        if (!value.trim()) {
            return 'Discussion time is required';
        }
        const num = parseInt(value);
        if (isNaN(num)) {
            return 'Please enter a valid number';
        }
        if (num < 30) {
            return 'Minimum is 30 seconds';
        }
        if (num > 600) {
            return 'Maximum is 600 seconds (10 minutes)';
        }
        return undefined;
    };

    // Get current effective values (edited or original)
    const currentGameType = editGameType ?? room?.settings.gameType ?? 'word';
    const currentImposterCount = editImposterCount ?? room?.settings.imposterCount ?? 1;
    const currentCategories = editCategories ?? room?.settings.categories ?? [];

    // Check if any settings have changed
    const hasChanges = useMemo(() => {
        if (!room) return false;
        return (
            (editGameType !== null && editGameType !== room.settings.gameType) ||
            (editImposterCount !== null && editImposterCount !== room.settings.imposterCount) ||
            editDiscussionTime !== room.settings.discussionTimeSeconds.toString() ||
            (editCategories !== null &&
                JSON.stringify(editCategories) !== JSON.stringify(room.settings.categories))
        );
    }, [room, editGameType, editImposterCount, editDiscussionTime, editCategories]);

    // Check if form is valid
    const isFormValid = useMemo(() => {
        const timeError = validateDiscussionTime(editDiscussionTime);
        const catError =
            currentCategories.length === 0 ? 'Select at least one category' : undefined;
        return !timeError && !catError;
    }, [editDiscussionTime, currentCategories]);

    useEffect(() => {
        const storedRoomCode = localStorage.getItem('imposter_room_code');
        if (!storedRoomId || storedRoomCode !== roomCode) {
            router.push(`/room/${roomCode}`);
            return;
        }

        const fetchRoom = async () => {
            try {
                const roomData = await trpcQuery<RoomData>(
                    'room.getState',
                    { roomId: storedRoomId },
                    { 'x-player-id': playerId || '' }
                );
                setRoom(roomData);

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

    const handleDiscussionTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEditDiscussionTime(value);

        // Validate on change
        const error = validateDiscussionTime(value);
        setErrors((prev) => ({ ...prev, discussionTime: error }));
    };

    const handleCategoryToggle = (cat: string) => {
        const currentCats = editCategories ?? room?.settings.categories ?? [];
        const isSelected = currentCats.includes(cat);
        const newCats = isSelected ? currentCats.filter((c) => c !== cat) : [...currentCats, cat];

        setEditCategories(newCats);

        // Validate categories
        if (newCats.length === 0) {
            setErrors((prev) => ({ ...prev, categories: 'Select at least one category' }));
        } else {
            setErrors((prev) => ({ ...prev, categories: undefined }));
        }
    };

    const handleUpdateSettings = async () => {
        if (!storedRoomId || !playerId || !hasChanges) return;

        // Final validation
        const timeError = validateDiscussionTime(editDiscussionTime);
        if (timeError) {
            setErrors((prev) => ({ ...prev, discussionTime: timeError }));
            return;
        }

        if (currentCategories.length === 0) {
            setErrors((prev) => ({ ...prev, categories: 'Select at least one category' }));
            return;
        }

        // Build update object with only changed values
        const updates: Partial<GameSettings> = {};
        if (editGameType !== null) updates.gameType = editGameType;
        if (editImposterCount !== null) updates.imposterCount = editImposterCount;
        if (editDiscussionTime !== room?.settings.discussionTimeSeconds.toString()) {
            updates.discussionTimeSeconds = parseInt(editDiscussionTime);
        }
        if (editCategories !== null) updates.categories = editCategories;

        setIsSaving(true);
        try {
            await trpcMutation(
                'room.updateSettings',
                { roomId: storedRoomId, settings: updates },
                { 'x-player-id': playerId }
            );
            toast.success('Settings updated!');
            setShowSettingsDialog(false);
        } catch (error) {
            console.error('Settings update error:', error);
            // Don't show toast, error is already visible in form
        } finally {
            setIsSaving(false);
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
                        <CardDescription>
                            This room doesn&apos;t exist or has expired.
                        </CardDescription>
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
                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                        player.id === playerId
                                            ? 'bg-primary/10 border border-primary/20'
                                            : 'bg-muted/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-2 h-2 rounded-full ${player.isConnected ? 'bg-green-500' : 'bg-gray-500'}`}
                                        />
                                        <span className="font-medium">{player.name}</span>
                                        {player.id === playerId && (
                                            <Badge variant="outline" className="text-xs">
                                                You
                                            </Badge>
                                        )}
                                    </div>
                                    {player.isHost && <Badge>Host</Badge>}
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
                                        {isHost
                                            ? 'Configure the game before starting'
                                            : 'Waiting for host to start'}
                                    </CardDescription>
                                </div>
                                {isHost && (
                                    <Dialog
                                        open={showSettingsDialog}
                                        onOpenChange={setShowSettingsDialog}
                                    >
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                ⚙️ Edit
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Game Settings</DialogTitle>
                                                <DialogDescription>
                                                    Configure the game options
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-5 pt-4">
                                                {/* Game Type */}
                                                <div>
                                                    <label className="text-sm font-medium">
                                                        Game Type
                                                    </label>
                                                    <div className="flex gap-2 mt-2">
                                                        <Button
                                                            variant={
                                                                currentGameType === 'word'
                                                                    ? 'default'
                                                                    : 'outline'
                                                            }
                                                            onClick={() => setEditGameType('word')}
                                                            className="flex-1"
                                                            type="button"
                                                        >
                                                            🎯 Word
                                                        </Button>
                                                        <Button
                                                            variant={
                                                                currentGameType === 'question'
                                                                    ? 'default'
                                                                    : 'outline'
                                                            }
                                                            onClick={() =>
                                                                setEditGameType('question')
                                                            }
                                                            className="flex-1"
                                                            type="button"
                                                        >
                                                            ❓ Question
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Imposter Count */}
                                                <div>
                                                    <label className="text-sm font-medium">
                                                        Number of Imposters
                                                    </label>
                                                    <div className="flex gap-2 mt-2">
                                                        {[1, 2, 3].map((count) => (
                                                            <Button
                                                                key={count}
                                                                variant={
                                                                    currentImposterCount === count
                                                                        ? 'default'
                                                                        : 'outline'
                                                                }
                                                                onClick={() =>
                                                                    setEditImposterCount(count)
                                                                }
                                                                className="flex-1"
                                                                type="button"
                                                            >
                                                                {count}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Discussion Time */}
                                                <div>
                                                    <label className="text-sm font-medium">
                                                        Discussion Time (seconds)
                                                    </label>
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={editDiscussionTime}
                                                        onChange={handleDiscussionTimeChange}
                                                        className={`mt-2 ${errors.discussionTime ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                                        placeholder="30-600"
                                                    />
                                                    {errors.discussionTime && (
                                                        <p className="text-sm text-red-500 mt-1">
                                                            {errors.discussionTime}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Categories */}
                                                <div>
                                                    <label className="text-sm font-medium">
                                                        Categories
                                                    </label>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {CATEGORIES.map((cat) => {
                                                            const isSelected =
                                                                currentCategories.includes(cat);
                                                            return (
                                                                <Button
                                                                    key={cat}
                                                                    variant={
                                                                        isSelected
                                                                            ? 'default'
                                                                            : 'outline'
                                                                    }
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleCategoryToggle(cat)
                                                                    }
                                                                    type="button"
                                                                >
                                                                    {cat}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                    {errors.categories && (
                                                        <p className="text-sm text-red-500 mt-1">
                                                            {errors.categories}
                                                        </p>
                                                    )}
                                                </div>

                                                <Button
                                                    className="w-full"
                                                    onClick={handleUpdateSettings}
                                                    disabled={
                                                        !hasChanges || !isFormValid || isSaving
                                                    }
                                                >
                                                    {isSaving ? 'Saving...' : 'Save Settings'}
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
                                    <p className="font-medium capitalize">
                                        {room.settings.gameType}
                                    </p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-muted-foreground">Imposters</p>
                                    <p className="font-medium">{room.settings.imposterCount}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-muted-foreground">Discussion Time</p>
                                    <p className="font-medium">
                                        {room.settings.discussionTimeSeconds}s
                                    </p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-muted-foreground">Show Category</p>
                                    <p className="font-medium">
                                        {room.settings.showCategoryToImposter ? 'Yes' : 'No'}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <p className="text-sm text-muted-foreground mb-2">Categories</p>
                                <div className="flex flex-wrap gap-2">
                                    {room.settings.categories.map((cat) => (
                                        <Badge key={cat} variant="secondary">
                                            {cat}
                                        </Badge>
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
                                {isStarting
                                    ? 'Starting...'
                                    : room.players.length < 2
                                      ? 'Need at least 2 players'
                                      : '🚀 Start Game'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {!isHost && (
                    <Card>
                        <CardContent className="pt-6 text-center">
                            <p className="text-muted-foreground">
                                Waiting for host to start the game...
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
