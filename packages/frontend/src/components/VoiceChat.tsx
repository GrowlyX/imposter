'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpcMutation, trpcQuery } from '@/lib/api';
import {
    RealtimeKitProvider,
    useRealtimeKitClient,
    useRealtimeKitMeeting,
    useRealtimeKitSelector,
} from '@cloudflare/realtimekit-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface VoiceChatProps {
    roomId: string;
    playerId: string;
    playerName: string;
}

type ConnectionState =
    | 'checking'
    | 'unavailable'
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'error';

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
                        ? i < 2
                            ? 'bg-green-500'
                            : i < 4
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                        : 'bg-muted'
                        }`}
                    style={{ height: `${((i + 1) / bars) * 100}%` }}
                />
            ))}
        </div>
    );
}

// Connected participant display
function ParticipantItem({
    name,
    isSelf,
    audioLevel,
    isMuted,
}: {
    name: string;
    isSelf: boolean;
    audioLevel: number;
    isMuted: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-between p-2 rounded-lg ${isSelf ? 'bg-primary/10' : 'bg-muted/50'}`}
        >
            <div className="flex items-center gap-2">
                <div
                    className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}
                />
                <span className="text-sm font-medium">
                    {name} {isSelf && '(You)'}
                </span>
            </div>
            {!isMuted && <AudioLevelIndicator level={audioLevel} />}
            {isMuted && <span className="text-xs text-muted-foreground">🔇</span>}
        </div>
    );
}

interface Participant {
    id: string;
    name?: string;
    audioEnabled?: boolean;
    customParticipantId?: string;
    audioTrack?: MediaStreamTrack;
}

// Component to play remote participant audio
function RemoteAudioPlayer({ participant }: { participant: Participant }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audioTrack = participant.audioTrack;
        if (!audioTrack || !audioRef.current) return;

        console.log('[VoiceChat] Setting up audio for participant:', participant.name);

        // Create MediaStream from the audio track
        const stream = new MediaStream([audioTrack]);
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(err => {
            console.error('[VoiceChat] Failed to play audio:', err);
        });

        return () => {
            if (audioRef.current) {
                audioRef.current.srcObject = null;
            }
        };
    }, [participant.audioTrack, participant.name]);

    return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

// Inner component that uses RealtimeKit hooks
function VoiceChatConnected({
    playerName,
    onDisconnect,
}: {
    playerName: string;
    onDisconnect: () => void;
}) {
    const { meeting } = useRealtimeKitMeeting();
    const [isMuted, setIsMuted] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [participantCount, setParticipantCount] = useState(0);
    const animationFrameRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Use selector for reactive participant count
    const joinedCount = useRealtimeKitSelector((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const joined = (m as any).participants?.joined;
        if (joined instanceof Map) {
            return joined.size;
        }
        return 0;
    });

    // Update when count changes
    useEffect(() => {
        setParticipantCount(joinedCount);

        // Re-read participants when count changes
        if (meeting) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const joined = (meeting as any).participants?.joined;
            if (joined instanceof Map) {
                const list = Array.from(joined.values()) as Participant[];
                console.log('[VoiceChat] Participants updated, count:', list.length, list);
                setParticipants(list);
            }
        }
    }, [joinedCount, meeting]);

    // Subscribe to participant events
    useEffect(() => {
        if (!meeting) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = meeting as any;

        console.log('[VoiceChat] Setting up participant subscriptions');
        console.log('[VoiceChat] meeting.participants:', m.participants);
        console.log('[VoiceChat] meeting.participants.joined:', m.participants?.joined);
        console.log('[VoiceChat] joined size:', m.participants?.joined?.size);

        // Get initial participants
        const updateParticipants = () => {
            const joined = m.participants?.joined;
            if (joined instanceof Map) {
                const list = Array.from(joined.values()) as Participant[];
                console.log('[VoiceChat] Updated participants:', list.length);
                setParticipants(list);
            }
        };

        updateParticipants();

        // Subscribe to participant join events
        const onParticipantJoined = (participant: Participant) => {
            console.log('[VoiceChat] Participant joined:', participant);
            updateParticipants();
        };

        const onParticipantLeft = (participant: Participant) => {
            console.log('[VoiceChat] Participant left:', participant);
            updateParticipants();
        };

        // Try subscribing to the joined map directly
        if (m.participants?.joined?.on) {
            console.log('[VoiceChat] Subscribing to joined.on events');
            m.participants.joined.on('participantJoined', onParticipantJoined);
            m.participants.joined.on('participantLeft', onParticipantLeft);
        }

        // Also try the participants object
        if (m.participants?.on) {
            console.log('[VoiceChat] Subscribing to participants.on events');
            m.participants.on('participantJoined', onParticipantJoined);
            m.participants.on('participantLeft', onParticipantLeft);
        }

        // Polling fallback
        const pollInterval = setInterval(updateParticipants, 2000);

        return () => {
            clearInterval(pollInterval);
            if (m.participants?.joined?.off) {
                m.participants.joined.off('participantJoined', onParticipantJoined);
                m.participants.joined.off('participantLeft', onParticipantLeft);
            }
            if (m.participants?.off) {
                m.participants.off('participantJoined', onParticipantJoined);
                m.participants.off('participantLeft', onParticipantLeft);
            }
        };
    }, [meeting]);

    // Get self info via selector
    const selfAudioEnabled = useRealtimeKitSelector((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (m as any).self?.audioEnabled ?? true;
    });

    // Update muted state from SDK
    useEffect(() => {
        setIsMuted(!selfAudioEnabled);
    }, [selfAudioEnabled]);

    // Set up audio level monitoring from local microphone
    useEffect(() => {
        let stream: MediaStream | null = null;

        const setupAudioMonitoring = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContextRef.current = new AudioContext();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;
                source.connect(analyserRef.current);

                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

                const updateLevel = () => {
                    if (analyserRef.current && !isMuted) {
                        analyserRef.current.getByteFrequencyData(dataArray);
                        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                        setAudioLevel(average / 255);
                    } else {
                        setAudioLevel(0);
                    }
                    animationFrameRef.current = requestAnimationFrame(updateLevel);
                };
                updateLevel();
            } catch (error) {
                console.error('Failed to set up audio monitoring:', error);
            }
        };

        setupAudioMonitoring();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [isMuted]);

    const toggleMute = async () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const self = (meeting as any).self;
            if (isMuted) {
                await self?.enableAudio?.();
            } else {
                await self?.disableAudio?.();
            }
            setIsMuted(!isMuted);
        } catch (error) {
            console.error('Failed to toggle mute:', error);
            setIsMuted(!isMuted);
        }
    };

    const handleLeave = async () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (meeting as any).leaveRoom?.();
        } catch (error) {
            console.error('Failed to leave room:', error);
        }
        onDisconnect();
    };

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
            {participants.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        Other Participants ({participants.length})
                    </p>
                    {participants.map((participant, idx) => (
                        <div key={participant.id || idx}>
                            <ParticipantItem
                                name={participant.name || 'Unknown'}
                                isSelf={false}
                                audioLevel={0}
                                isMuted={participant.audioEnabled === false}
                            />
                            {/* Audio player for this participant */}
                            <RemoteAudioPlayer participant={participant} />
                        </div>
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
                <Button variant="outline" onClick={handleLeave} className="flex-1" size="sm">
                    📴 Leave
                </Button>
            </div>

            {/* Debug info */}
            <p className="text-xs text-muted-foreground/50 text-center">
                Joined: {participantCount} | Displayed: {participants.length}
            </p>
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
                const result = await trpcQuery<{ available: boolean }>(
                    'audio.isAvailable',
                    {},
                    { 'x-player-id': playerId }
                );
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

            console.log('[VoiceChat] Got auth token for meeting:', result.meetingId);

            // Initialize RealtimeKit meeting with the auth token
            const mtg = await initMeeting({
                authToken: result.authToken,
                defaults: {
                    audio: true,
                    video: false,
                },
            });

            console.log('[VoiceChat] Meeting client initialized, now joining room...');

            // IMPORTANT: Must call join() to actually connect to the room
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((mtg as any)?.join) {
                await (mtg as any).join();
                console.log('[VoiceChat] Successfully joined room!');
            } else {
                console.log('[VoiceChat] No join method found on meeting object');
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log(
                '[VoiceChat] participants.joined size after join:',
                (mtg as any)?.participants?.joined?.size
            );

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
                            <p className="text-sm font-medium text-muted-foreground">
                                Voice chat is not configured
                            </p>
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
                        <VoiceChatConnected
                            playerName={playerName}
                            onDisconnect={handleDisconnect}
                        />
                    </RealtimeKitProvider>
                )}

                {connectionState === 'error' && (
                    <div className="text-center space-y-4">
                        <p className="text-sm text-red-500">Failed to connect to voice chat</p>
                        <Button
                            onClick={() => setConnectionState('disconnected')}
                            variant="outline"
                            className="w-full"
                        >
                            Try Again
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
