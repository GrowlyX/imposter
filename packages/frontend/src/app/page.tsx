'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { trpcMutation } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsCreating(true);
    try {
      const result = await trpcMutation<{
        playerId: string;
        roomId: string;
        roomCode: string;
        serverId: string;
      }>('room.create', { playerName: playerName.trim() });

      // Store session data
      localStorage.setItem('imposter_player_id', result.playerId);
      localStorage.setItem('imposter_player_name', playerName.trim());
      localStorage.setItem('imposter_room_id', result.roomId);
      localStorage.setItem('imposter_room_code', result.roomCode);
      localStorage.setItem('imposter_server_id', result.serverId);

      toast.success('Room created!');
      router.push(`/room/${result.roomCode}/lobby`);
    } catch (error) {
      toast.error('Failed to create room. Please try again.');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!roomCode.trim() || roomCode.length !== 6) {
      toast.error('Please enter a valid 6-digit room code');
      return;
    }

    setIsJoining(true);
    try {
      const result = await trpcMutation<{
        playerId: string;
        roomId: string;
        roomCode: string;
        serverId: string;
      }>('room.join', { code: roomCode.trim(), playerName: playerName.trim() });

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-chart-1/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-sm text-muted-foreground">Multiplayer Party Game</span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight">
            IMPOSTER
          </h1>
          <p className="text-muted-foreground text-lg font-serif italic">
            Find the imposter among your friends
          </p>
        </div>

        {/* Game Modes */}
        <div className="flex justify-center gap-3">
          <Badge variant="secondary" className="px-3 py-1">
            🎯 Word Game
          </Badge>
          <Badge variant="secondary" className="px-3 py-1">
            ❓ Question Game
          </Badge>
        </div>

        <Separator />

        {/* Action Cards */}
        <div className="grid gap-4">
          {/* Create Room */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 group">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">✨</span>
                    Create Room
                  </CardTitle>
                  <CardDescription>
                    Start a new game and invite your friends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full group-hover:bg-primary/90" size="lg">
                    Create New Room
                  </Button>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Room</DialogTitle>
                <DialogDescription>
                  Enter your name to create a room. You&apos;ll get a code to share with friends.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={30}
                  className="text-lg"
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Room'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Join Room */}
          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 group">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🔗</span>
                    Join Room
                  </CardTitle>
                  <CardDescription>
                    Enter a room code to join an existing game
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full" size="lg">
                    Join Existing Room
                  </Button>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a Room</DialogTitle>
                <DialogDescription>
                  Enter your name and the 6-digit room code to join.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={30}
                  className="text-lg"
                />
                <Input
                  placeholder="Room code (6 digits)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-lg text-center tracking-widest font-mono"
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleJoinRoom}
                  disabled={isJoining}
                >
                  {isJoining ? 'Joining...' : 'Join Room'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Play with 3-20 players • Voice chat included
        </p>
      </div>
    </main>
  );
}
