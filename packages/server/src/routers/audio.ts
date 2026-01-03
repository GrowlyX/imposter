import { z } from 'zod';
import { router, authedProcedure } from '../trpc.js';
import { getRoomById, getMeetingId, saveMeetingIdIfNotExists } from '../lib/redis.js';
import { TRPCError } from '@trpc/server';
import { config } from '../config.js';

// Cloudflare RealtimeKit API base URL
const RTK_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

// Helper to make authenticated RealtimeKit API calls
async function rtkFetch<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: object
): Promise<T> {
    const url = `${RTK_API_BASE}/${config.cloudflareAccountId}/realtime/kit/${config.cloudflareRtkAppId}${endpoint}`;

    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${config.cloudflareApiToken}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json() as { success: boolean; errors?: Array<{ message: string }>; data?: T };

    if (!response.ok || !data.success) {
        const errorMessage = data.errors?.[0]?.message || `API error: ${response.status}`;
        throw new Error(errorMessage);
    }

    return data.data as T;
}

export const audioRouter = router({
    // Check if audio is available
    isAvailable: authedProcedure
        .query(() => {
            return { available: config.isRealtimeKitConfigured };
        }),

    // Join the audio call for a room
    joinCall: authedProcedure
        .input(z.object({
            roomId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const room = await getRoomById(input.roomId);

            if (!room) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
            }

            const player = room.players.find((p) => p.id === ctx.playerId);
            if (!player) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
            }

            if (!config.isRealtimeKitConfigured) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Voice chat requires Cloudflare RealtimeKit configuration',
                });
            }

            try {
                // Get existing meeting or create one atomically
                let meetingId = await getMeetingId(input.roomId);

                if (!meetingId) {
                    // No meeting exists - create one
                    const meeting = await rtkFetch<{ id: string }>(
                        '/meetings',
                        'POST',
                        { title: `Imposter Room ${room.code}` }
                    );

                    // Try to save atomically - if another request already saved one, use that instead
                    const saved = await saveMeetingIdIfNotExists(input.roomId, meeting.id);

                    if (saved) {
                        meetingId = meeting.id;
                    } else {
                        // Another request beat us - use the existing meeting
                        meetingId = await getMeetingId(input.roomId);
                        if (!meetingId) {
                            throw new Error('Failed to get or create meeting');
                        }
                    }
                }

                // Add participant to the meeting
                const participant = await rtkFetch<{ id: string; token: string }>(
                    `/meetings/${meetingId}/participants`,
                    'POST',
                    {
                        custom_participant_id: ctx.playerId,
                        preset_name: player.isHost ? 'imp_game_vc_host' : 'imp_game_vc_participant',
                        name: player.name,
                    }
                );

                return {
                    authToken: participant.token,
                    meetingId,
                };
            } catch (error) {
                console.error('RealtimeKit error:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to join audio call',
                });
            }
        }),

    // Leave the audio call
    leaveCall: authedProcedure
        .input(z.object({
            roomId: z.string(),
        }))
        .mutation(async () => {
            // Client-side SDK handles disconnection
            return { success: true };
        }),
});
