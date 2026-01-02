'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { trpcMutation } from '@/lib/api';

interface VoiceChatProps {
    roomId: string;
    playerId: string;
    playerName: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export function VoiceChat({ roomId, playerId, playerName }: VoiceChatProps) {
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [isMuted, setIsMuted] = useState(false);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [meetingId, setMeetingId] = useState<string | null>(null);

    const handleConnect = useCallback(async () => {
        if (connectionState === 'connecting' || connectionState === 'connected') return;

        setConnectionState('connecting');
        try {
            const result = await trpcMutation<{ authToken: string; meetingId: string }>(
                'audio.joinCall',
                { roomId },
                { 'x-player-id': playerId }
            );

            setAuthToken(result.authToken);
            setMeetingId(result.meetingId);
            setConnectionState('connected');
            toast.success('Connected to voice chat!');
        } catch (error) {
            console.error('Failed to connect to voice chat:', error);
            setConnectionState('error');
            toast.error(error instanceof Error ? error.message : 'Failed to connect to voice chat');
        }
    }, [roomId, playerId, connectionState]);

    const handleDisconnect = useCallback(async () => {
        try {
            await trpcMutation('audio.leaveCall', { roomId }, { 'x-player-id': playerId });
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
        setAuthToken(null);
        setMeetingId(null);
        setConnectionState('disconnected');
        toast.success('Disconnected from voice chat');
    }, [roomId, playerId]);

    const toggleMute = () => {
        setIsMuted(!isMuted);
        // TODO: Integrate with RealtimeKit SDK to actually mute/unmute
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (connectionState === 'connected') {
                handleDisconnect();
            }
        };
    }, [connectionState, handleDisconnect]);

    const getStatusColor = () => {
        switch (connectionState) {
            case 'connected':
                return 'bg-green-500';
            case 'connecting':
                return 'bg-yellow-500 animate-pulse';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusText = () => {
        switch (connectionState) {
            case 'connected':
                return 'Connected';
            case 'connecting':
                return 'Connecting...';
            case 'error':
                return 'Error';
            default:
                return 'Disconnected';
        }
    };

    return (
        <Card>
            <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        🎙️ Voice Chat
                        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                    </div>
                    <Badge variant={connectionState === 'connected' ? 'default' : 'secondary'}>
                        {getStatusText()}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {connectionState === 'disconnected' && (
                    <div className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Join voice chat to talk with other players
                        </p>
                        <Button onClick={handleConnect} className="w-full">
                            🎤 Join Voice Chat
                        </Button>
                    </div>
                )}

                {connectionState === 'connecting' && (
                    <div className="text-center space-y-4">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground">Connecting to voice chat...</p>
                    </div>
                )}

                {connectionState === 'connected' && (
                    <div className="space-y-4">
                        {/* Voice controls */}
                        <div className="flex gap-2">
                            <Button
                                variant={isMuted ? 'destructive' : 'secondary'}
                                onClick={toggleMute}
                                className="flex-1"
                            >
                                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDisconnect}
                                className="flex-1"
                            >
                                📴 Leave
                            </Button>
                        </div>

                        {/* Meeting info (for debugging) */}
                        {meetingId && (
                            <p className="text-xs text-muted-foreground text-center">
                                Meeting: {meetingId.slice(0, 8)}...
                            </p>
                        )}

                        {/* Note about SDK integration */}
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            <p className="font-medium">📝 Integration Note:</p>
                            <p>To enable full voice chat functionality, add the Cloudflare RealtimeKit React SDK:</p>
                            <code className="block mt-1 text-primary">
                                @cloudflare/realtimekit-react
                            </code>
                        </div>
                    </div>
                )}

                {connectionState === 'error' && (
                    <div className="text-center space-y-4">
                        <p className="text-sm text-red-500">Failed to connect to voice chat</p>
                        <Button onClick={() => setConnectionState('disconnected')} variant="outline" className="w-full">
                            Try Again
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
