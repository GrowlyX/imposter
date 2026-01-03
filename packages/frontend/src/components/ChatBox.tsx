'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpcMutation, trpcQuery } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ChatMessage {
    id: string;
    roomId: string;
    playerId: string;
    playerName: string;
    content: string;
    timestamp: number;
}

interface ChatBoxProps {
    roomId: string;
    playerId: string;
    playerName: string;
}

const MAX_MESSAGE_LENGTH = 512;

export function ChatBox({ roomId, playerId, playerName }: ChatBoxProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastMessageIdRef = useRef<string | null>(null);

    // Fetch chat history and poll for new messages
    const fetchMessages = useCallback(async () => {
        try {
            const history = await trpcQuery<ChatMessage[]>(
                'chat.getHistory',
                { roomId },
                { 'x-player-id': playerId }
            );

            // Only update if we have new messages
            const latestId = history[history.length - 1]?.id;
            if (latestId !== lastMessageIdRef.current) {
                setMessages(history);
                lastMessageIdRef.current = latestId;

                // Auto-scroll to bottom on new messages
                setTimeout(() => {
                    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
        }
    }, [roomId, playerId]);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 1500); // Poll every 1.5s
        return () => clearInterval(interval);
    }, [fetchMessages]);

    const handleSend = async () => {
        if (!newMessage.trim() || isSending || newMessage.length > MAX_MESSAGE_LENGTH) return;

        setIsSending(true);
        try {
            const message = await trpcMutation<ChatMessage>(
                'chat.send',
                {
                    roomId,
                    content: newMessage.trim(),
                },
                { 'x-player-id': playerId }
            );

            // Optimistically add message
            setMessages((prev) => [...prev, message]);
            setNewMessage('');

            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const charCount = newMessage.length;
    const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
    const charIndicatorColor = isOverLimit
        ? 'text-red-500'
        : charCount > MAX_MESSAGE_LENGTH * 0.9
          ? 'text-yellow-500'
          : 'text-muted-foreground';

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="py-3 px-4 border-b flex-shrink-0">
                <CardTitle className="text-lg flex items-center gap-2">
                    💬 Chat
                    <span className="text-xs font-normal text-muted-foreground">
                        ({messages.length} messages)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                <ScrollArea className="flex-1" ref={scrollAreaRef}>
                    <div className="p-4 space-y-3">
                        {messages.length === 0 ? (
                            <p className="text-center text-muted-foreground text-sm py-4">
                                No messages yet. Start the conversation!
                            </p>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${msg.playerId === playerId ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-lg px-3 py-2 ${
                                            msg.playerId === playerId
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                        }`}
                                    >
                                        {msg.playerId !== playerId && (
                                            <p className="text-xs font-medium mb-1 opacity-70">
                                                {msg.playerName}
                                            </p>
                                        )}
                                        <p className="text-sm break-words whitespace-pre-wrap">
                                            {msg.content}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-1">
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            ))
                        )}
                        <div ref={bottomRef} />
                    </div>
                </ScrollArea>

                <div className="p-3 border-t flex-shrink-0 space-y-1">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={MAX_MESSAGE_LENGTH + 10} // Allow slight overflow to show error
                            disabled={isSending}
                            className={`flex-1 ${isOverLimit ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!newMessage.trim() || isSending || isOverLimit}
                            size="sm"
                        >
                            Send
                        </Button>
                    </div>
                    <div className="flex justify-end">
                        <span className={`text-xs ${charIndicatorColor}`}>
                            {charCount}/{MAX_MESSAGE_LENGTH}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
