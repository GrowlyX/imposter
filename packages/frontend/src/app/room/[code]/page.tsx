'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trpcMutation } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function JoinRoomPage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.code as string;

    const [playerName, setPlayerName] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [roomExists, setRoomExists] = useState<boolean | null>(null);

    // Check if user already has a session for this room
    useEffect(() => {
        const storedRoomCode = localStorage.getItem('imposter_room_code');
        const storedPlayerId = localStorage.getItem('imposter_player_id');
        const storedRoomId = localStorage.getItem('imposter_room_id');

        if (storedRoomCode === roomCode && storedPlayerId && storedRoomId) {
            // User already in this room - redirect to lobby
            router.push(`/room/${roomCode}/lobby`);
            return;
        }

        // Check if room exists
        const checkRoom = async () => {
            try {
                // Try to get room by code first (we need an endpoint for this)
                // For now, we'll just show the join form
                setRoomExists(true);
            } catch {
                setRoomExists(false);
            } finally {
                setIsCheckingSession(false);
            }
        };

        checkRoom();
    }, [roomCode, router]);

    const handleJoin = async () => {
        if (!playerName.trim()) {
            toast.error('Please enter your name');
            return;
        }

        setIsJoining(true);
        try {
            const result = await trpcMutation<{
                playerId: string;
                roomId: string;
                roomCode: string;
                serverId: string;
            }>('room.join', { code: roomCode, playerName: playerName.trim() });

            // Store session data
            localStorage.setItem('imposter_player_id', result.playerId);
            localStorage.setItem('imposter_player_name', playerName.trim());
            localStorage.setItem('imposter_room_id', result.roomId);
            localStorage.setItem('imposter_room_code', result.roomCode);
            localStorage.setItem('imposter_server_id', result.serverId);

            toast.success('Joined room!');
            router.push(`/room/${result.roomCode}/lobby`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to join room');
            console.error(error);
        } finally {
            setIsJoining(false);
        }
    };

    if (isCheckingSession) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </main>
        );
    }

    if (roomExists === false) {
        return (
            <main className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle>Room Not Found</CardTitle>
                        <CardDescription>
                            The room with code{' '}
                            <span className="font-mono font-bold">{roomCode}</span> doesn&apos;t
                            exist or has expired.
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
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-chart-1/5 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <Card className="relative z-10 w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mb-4">
                        <span className="text-4xl">🎮</span>
                    </div>
                    <CardTitle className="text-2xl">Join Room</CardTitle>
                    <CardDescription>
                        You&apos;ve been invited to join room{' '}
                        <span className="font-mono font-bold text-primary">{roomCode}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Enter your name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={30}
                        className="text-lg"
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleJoin}
                        disabled={isJoining || !playerName.trim()}
                    >
                        {isJoining ? 'Joining...' : 'Join Game'}
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
                        Go Home
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
