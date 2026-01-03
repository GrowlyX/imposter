'use client';

import { ChatBox } from '@/components/ChatBox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { VoiceChat } from '@/components/VoiceChat';
import { trpcMutation, trpcQuery } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface PlayerGameData {
    isImposter: boolean;
    word?: string | null;
    hint?: string | null;
    category?: string | null;
    question?: string;
}

interface GameState {
    phase: 'confirming' | 'answering' | 'discussion' | 'reveal';
    word?: string;
    realQuestion?: string;
    imposterQuestion?: string;
    answers?: Record<string, string>;
    playerRoles?: Record<string, 'player' | 'imposter'>;
    confirmedPlayers?: string[];
    phaseEndsAt?: number;
}

interface RoomData {
    hostId: string;
    state: string;
    gameState: GameState | null;
    settings: {
        gameType: string;
        discussionTimeSeconds: number;
    };
    players: Array<{ id: string; name: string }>;
}

export default function GamePage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.code as string;

    const [playerData, setPlayerData] = useState<PlayerGameData | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [room, setRoom] = useState<RoomData | null>(null);
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const playerId =
        typeof window !== 'undefined' ? localStorage.getItem('imposter_player_id') : null;
    const playerName =
        typeof window !== 'undefined'
            ? localStorage.getItem('imposter_player_name') || 'Player'
            : 'Player';
    const storedRoomId =
        typeof window !== 'undefined' ? localStorage.getItem('imposter_room_id') : null;
    const isHost = room?.hostId === playerId;

    useEffect(() => {
        const fetchData = async () => {
            if (!storedRoomId || !playerId) {
                router.push('/');
                return;
            }

            try {
                // Fetch room state
                const roomResult = await trpcQuery<RoomData>(
                    'room.getState',
                    { roomId: storedRoomId },
                    { 'x-player-id': playerId }
                );
                setRoom(roomResult);
                setGameState(roomResult?.gameState || null);

                // Fetch player's personal game data
                try {
                    const playerDataResult = await trpcQuery<PlayerGameData>(
                        'game.getMyData',
                        { roomId: storedRoomId },
                        { 'x-player-id': playerId }
                    );
                    setPlayerData(playerDataResult);
                } catch {
                    // Game data may not exist yet
                }

                if (roomResult?.state === 'lobby') {
                    router.push(`/room/${roomCode}/lobby`);
                }
            } catch (error) {
                console.error('Failed to fetch game data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [storedRoomId, playerId, router, roomCode]);

    // Timer countdown
    useEffect(() => {
        if (!gameState?.phaseEndsAt) {
            setTimeLeft(null);
            return;
        }

        const updateTimer = () => {
            const remaining = Math.max(0, Math.floor((gameState.phaseEndsAt! - Date.now()) / 1000));
            setTimeLeft(remaining);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [gameState?.phaseEndsAt]);

    const handleConfirmWord = async () => {
        if (!storedRoomId || !playerId) return;
        try {
            await trpcMutation(
                'game.confirmWord',
                { roomId: storedRoomId },
                { 'x-player-id': playerId }
            );
            toast.success('Confirmed!');
        } catch (error) {
            toast.error('Failed to confirm');
        }
    };

    const handleSubmitAnswer = async () => {
        if (!storedRoomId || !playerId || !answer.trim()) return;
        try {
            await trpcMutation(
                'game.submitAnswer',
                { roomId: storedRoomId, answer: answer.trim() },
                { 'x-player-id': playerId }
            );
            toast.success('Answer submitted!');
        } catch (error) {
            toast.error('Failed to submit answer');
        }
    };

    const handleForceReveal = async () => {
        if (!storedRoomId || !playerId) return;
        try {
            await trpcMutation(
                'game.forceReveal',
                { roomId: storedRoomId },
                { 'x-player-id': playerId }
            );
        } catch (error) {
            toast.error('Failed to reveal');
        }
    };

    const handleEndGame = async () => {
        if (!storedRoomId || !playerId) return;
        try {
            await trpcMutation(
                'game.endGame',
                { roomId: storedRoomId },
                { 'x-player-id': playerId }
            );
            router.push(`/room/${roomCode}/lobby`);
        } catch (error) {
            toast.error('Failed to end game');
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </main>
        );
    }

    const hasConfirmed = gameState?.confirmedPlayers?.includes(playerId || '');
    const hasAnswered = gameState?.answers?.[playerId || ''];

    return (
        <main className="min-h-screen p-4 bg-gradient-to-br from-background via-background to-primary/5">
            <div className="max-w-6xl mx-auto">
                {/* Timer */}
                {timeLeft !== null && timeLeft > 0 && (
                    <div className="text-center mb-6">
                        <Badge variant="destructive" className="text-lg px-4 py-2">
                            ⏱️ {Math.floor(timeLeft / 60)}:
                            {(timeLeft % 60).toString().padStart(2, '0')}
                        </Badge>
                    </div>
                )}

                {/* Non-discussion phases - centered layout */}
                {gameState?.phase !== 'discussion' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {/* Word Game - Confirming Phase */}
                        {gameState?.phase === 'confirming' && (
                            <Card className="border-2 border-primary/50">
                                <CardHeader className="text-center">
                                    <CardTitle className="text-3xl">
                                        {playerData?.isImposter
                                            ? '🕵️ You are the IMPOSTER!'
                                            : '👤 Your Word'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-center space-y-6">
                                    {playerData?.isImposter ? (
                                        <div className="space-y-4">
                                            <p className="text-5xl font-bold text-red-500">
                                                IMPOSTER
                                            </p>
                                            {playerData.hint && (
                                                <p className="text-muted-foreground">
                                                    Hint: {playerData.hint}
                                                </p>
                                            )}
                                            {playerData.category && (
                                                <p className="text-muted-foreground">
                                                    Category: {playerData.category}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <p className="text-5xl font-bold text-primary">
                                                {playerData?.word}
                                            </p>
                                            {playerData?.category && (
                                                <Badge variant="secondary">
                                                    {playerData.category}
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    {!hasConfirmed ? (
                                        <Button
                                            size="lg"
                                            onClick={handleConfirmWord}
                                            className="w-full"
                                        >
                                            ✅ I&apos;ve Seen My{' '}
                                            {playerData?.isImposter ? 'Role' : 'Word'}
                                        </Button>
                                    ) : (
                                        <p className="text-muted-foreground">
                                            Waiting for others... (
                                            {gameState.confirmedPlayers?.length}/
                                            {room?.players.length})
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Question Game - Answering Phase */}
                        {gameState?.phase === 'answering' && (
                            <Card className="border-2 border-primary/50">
                                <CardHeader className="text-center">
                                    <CardTitle>Answer the Question</CardTitle>
                                    <CardDescription>
                                        {playerData?.isImposter &&
                                            '🕵️ You have a different question!'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <p className="text-xl font-medium text-center">
                                        {playerData?.question}
                                    </p>

                                    {!hasAnswered ? (
                                        <div className="space-y-4">
                                            <Input
                                                placeholder="Your answer..."
                                                value={answer}
                                                onChange={(e) => setAnswer(e.target.value)}
                                                className="text-lg"
                                                maxLength={500}
                                            />
                                            <Button
                                                size="lg"
                                                onClick={handleSubmitAnswer}
                                                className="w-full"
                                                disabled={!answer.trim()}
                                            >
                                                Submit Answer
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground">
                                            Answer submitted! Waiting for others...
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Reveal Phase */}
                        {gameState?.phase === 'reveal' && (
                            <Card className="border-2 border-primary/50">
                                <CardHeader className="text-center">
                                    <CardTitle className="text-3xl">
                                        🎭 The Imposters Were...
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-2">
                                        {Object.entries(gameState.playerRoles || {}).map(
                                            ([pid, role]) => {
                                                const player = room?.players.find(
                                                    (p) => p.id === pid
                                                );
                                                return (
                                                    <div
                                                        key={pid}
                                                        className={`p-4 rounded-lg text-center ${
                                                            role === 'imposter'
                                                                ? 'bg-red-500/20 border-2 border-red-500'
                                                                : 'bg-muted/50'
                                                        }`}
                                                    >
                                                        <p className="font-bold text-lg">
                                                            {player?.name}
                                                        </p>
                                                        <Badge
                                                            variant={
                                                                role === 'imposter'
                                                                    ? 'destructive'
                                                                    : 'secondary'
                                                            }
                                                        >
                                                            {role === 'imposter'
                                                                ? '🕵️ Imposter'
                                                                : '👤 Player'}
                                                        </Badge>
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>

                                    {room?.settings.gameType === 'word' && gameState.word && (
                                        <div className="text-center p-4 bg-primary/10 rounded-lg">
                                            <p className="text-muted-foreground">The word was:</p>
                                            <p className="text-2xl font-bold text-primary">
                                                {gameState.word}
                                            </p>
                                        </div>
                                    )}

                                    {room?.settings.gameType === 'question' && (
                                        <div className="text-center p-4 bg-primary/10 rounded-lg space-y-2">
                                            <p className="text-muted-foreground">Real question:</p>
                                            <p className="font-medium">{gameState.realQuestion}</p>
                                            <p className="text-muted-foreground mt-2">
                                                Imposter question:
                                            </p>
                                            <p className="font-medium text-red-400">
                                                {gameState.imposterQuestion}
                                            </p>
                                        </div>
                                    )}

                                    {isHost && (
                                        <Button
                                            onClick={handleEndGame}
                                            className="w-full"
                                            size="lg"
                                        >
                                            🔄 Play Again
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* Discussion Phase - Split layout with chat */}
                {gameState?.phase === 'discussion' && storedRoomId && playerId && (
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Main content */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader className="text-center">
                                    <CardTitle>💬 Discussion Time</CardTitle>
                                    <CardDescription>
                                        Discuss and find the imposter!
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {room?.settings.gameType === 'question' &&
                                        gameState.answers && (
                                            <div className="space-y-2">
                                                <p className="font-medium">
                                                    Question: {gameState.realQuestion}
                                                </p>
                                                <div className="grid gap-2 mt-4">
                                                    {Object.entries(gameState.answers).map(
                                                        ([pid, ans]) => {
                                                            const player = room.players.find(
                                                                (p) => p.id === pid
                                                            );
                                                            return (
                                                                <div
                                                                    key={pid}
                                                                    className="p-3 rounded-lg bg-muted/50"
                                                                >
                                                                    <p className="font-medium">
                                                                        {player?.name}
                                                                    </p>
                                                                    <p className="text-muted-foreground">
                                                                        {ans}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    {room?.settings.gameType === 'word' && (
                                        <div className="text-center p-6 bg-muted/30 rounded-lg">
                                            <p className="text-lg text-muted-foreground mb-2">
                                                Take turns describing your word without saying it!
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                The imposter is trying to blend in...
                                            </p>
                                        </div>
                                    )}

                                    {/* Voice Chat */}
                                    <div className="pt-4">
                                        <VoiceChat
                                            roomId={storedRoomId}
                                            playerId={playerId}
                                            playerName={playerName}
                                        />
                                    </div>

                                    {isHost && (
                                        <Button
                                            variant="destructive"
                                            onClick={handleForceReveal}
                                            className="w-full"
                                        >
                                            🎭 Reveal Imposters
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Chat sidebar */}
                        <div className="lg:col-span-1 h-[600px]">
                            <ChatBox
                                roomId={storedRoomId}
                                playerId={playerId}
                                playerName={playerName}
                            />
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
