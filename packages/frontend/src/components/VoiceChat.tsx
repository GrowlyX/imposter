'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { trpcMutation, trpcQuery } from '@/lib/api';
import {
    useRealtimeKitClient,
    RealtimeKitProvider,
    useRealtimeKitMeeting,
    useRealtimeKitSelector,
} from '@cloudflare/realtimekit-react';

interface VoiceChatProps {
    roomId: string;
    playerId: string;
    playerName: string;
}

type ConnectionState = 'checking' | 'unavailable' | 'disconnected' | 'connecting' | 'connected' | 'error';

// Audio level indicator component
function AudioLevelIndicator({ level }: { level: number }) {
    const bars = 5;
    const activeLevel = Math.min(bars, Math.ceil(level * bars));

    return (
        <div className="flex items-center gap-0.5 h-4">
            {Array.from({ length: bars }).map((_, i) => (
                <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-75 ${i < activeLevel
                            ? i < 2 ? 'bg-green-500' : i < 4 ? 'bg-yellow-500' : 'bg-red-500'
                            : 'bg-muted'
                        }`}
                    style={{ height: `${((i + 1) / bars) * 100}%` }}
                />
            ))}
        </div>
    );
}

// Connected participant display
function ParticipantItem({ name, isSelf, audioLevel, isMuted }: {
    name: string;
    isSelf: boolean;
    audioLevel: number;
    isMuted: boolean;
}) {
    return (
        <div className={`flex items-center justify-between p-2 rounded-lg ${isSelf ? 'bg-primary/10' : 'bg-muted/50'}`}>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-sm font-medium">
                    {name} {isSelf && '(You)'}
                </span>
            </div>
            {!isMuted && <AudioLevelIndicator level={audioLevel} />}
            {isMuted && <span className="text-xs text-muted-foreground">🔇</span>}
        </div>
    );
}

// Inner component that uses RealtimeKit hooks
function VoiceChatConnected({ playerName, onDisconnect }: { playerName: string; onDisconnect: () => void }) {
    const { meeting } = useRealtimeKitMeeting();
    const [isMuted, setIsMuted] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Get participants from the meeting
    const participants = useRealtimeKitSelector((m) => m.participants?.joined || new Map());
    const self = useRealtimeKitSelector((m) => m.self);

    // Set up audio level monitoring
    useEffect(() => {
        const audioTrack = self?.media?.audioTrack;
        if (!audioTrack) return;

        try {
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(new MediaStream([audioTrack]));
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

            const updateLevel = () => {
                if (analyserRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    setAudioLevel(average / 255);
                }
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();
        } catch (error) {
            console.error('Failed to set up audio level monitoring:', error);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [self?.media?.audioTrack]);

    const toggleMute = async () => {
        try {
            if (isMuted) {
                await self?.media?.enableAudio();
            } else {
                await self?.media?.disableAudio();
            }
            setIsMuted(!isMuted);
        } catch (error) {
            console.error('Failed to toggle mute:', error);
        }
    };

    const handleLeave = async () => {
        try {
            await meeting.leaveRoom();
        } catch (error) {
            console.error('Failed to leave room:', error);
        }
        onDisconnect();
    };

    // Convert participants map to array
    const participantList = Array.from(participants.values());

    return (
        <div className="space-y-4">
            {/* Self participant */}
            <ParticipantItem
                name={playerName}
                isSelf={true}
                audioLevel={audioLevel}
                isMuted={isMuted}
            />

            {/* Other participants */}
            {participantList.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Other Participants ({participantList.length})</p>
                    {participantList.map((participant) => (
                        <ParticipantItem
                            key={participant.id}
                            name={participant.name || 'Unknown'}
                            isSelf={false}
                            audioLevel={0}
                            isMuted={!participant.audioEnabled}
                        />
                    ))}
                </div>
            )}

            {/* Voice controls */}
            <div className="flex gap-2 pt-2">
                <Button
                    variant={isMuted ? 'destructive' : 'secondary'}
                    onClick={toggleMute}
                    className="flex-1"
                    size="sm"
                >
                    {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleLeave}
                    className="flex-1"
                    size="sm"
                >
                    📴 Leave
                </Button>
            </div>
        </div>
    );
}

export function VoiceChat({ roomId, playerId, playerName }: VoiceChatProps) {
    const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
    const [meeting, initMeeting] = useRealtimeKitClient();

    // Check if voice chat is available on mount
    useEffect(() => {
        const checkAvailability = async () => {
            try {
                const result = await trpcQuery<{ available: boolean }>('audio.isAvailable', {}, { 'x-player-id': playerId });
                setConnectionState(result.available ? 'disconnected' : 'unavailable');
            } catch {
                setConnectionState('unavailable');
            }
        };
        checkAvailability();
    }, [playerId]);

    const handleConnect = useCallback(async () => {
        if (connectionState === 'connecting' || connectionState === 'connected') return;

        setConnectionState('connecting');
        try {
            // Get auth token from server
            const result = await trpcMutation<{ authToken: string; meetingId: string }>(
                'audio.joinCall',
                { roomId },
                { 'x-player-id': playerId }
            );

            // Initialize RealtimeKit meeting with the auth token
            await initMeeting({
                authToken: result.authToken,
                defaults: {
                    audio: true,
                    video: false,
                },
            });

            setConnectionState('connected');
            toast.success('Connected to voice chat!');
        } catch (error) {
            console.error('Failed to connect to voice chat:', error);
            setConnectionState('error');
            toast.error(error instanceof Error ? error.message : 'Failed to connect to voice chat');
        }
    }, [roomId, playerId, connectionState, initMeeting]);

    const handleDisconnect = useCallback(() => {
        setConnectionState('disconnected');
        toast.success('Disconnected from voice chat');
    }, []);

    const getStatusColor = () => {
        switch (connectionState) {
            case 'connected':
                return 'bg-green-500';
            case 'connecting':
                return 'bg-yellow-500 animate-pulse';
            case 'error':
                return 'bg-red-500';
            case 'unavailable':
                return 'bg-gray-400';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusText = () => {
        switch (connectionState) {
            case 'checking':
                return 'Checking...';
            case 'connected':
                return 'Connected';
            case 'connecting':
                return 'Connecting...';
            case 'error':
                return 'Error';
            case 'unavailable':
                return 'Not Available';
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
            <CardContent className="p-4">
                {connectionState === 'checking' && (
                    <div className="text-center space-y-4">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground">Checking availability...</p>
                    </div>
                )}

                {connectionState === 'unavailable' && (
                    <div className="text-center space-y-3 py-2">
                        <div className="text-4xl">🔇</div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Voice chat is not configured</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Use the text chat to communicate with other players
                            </p>
                        </div>
                    </div>
                )}

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

                {connectionState === 'connected' && meeting && (
                    <RealtimeKitProvider value={meeting}>
                        <VoiceChatConnected playerName={playerName} onDisconnect={handleDisconnect} />
                    </RealtimeKitProvider>
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
