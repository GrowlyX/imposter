import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { config } from '../config.js';
import { getMeetingId, getRoomById, saveMeetingIdIfNotExists } from '../lib/redis.js';
import { authedProcedure, router } from '../trpc.js';

// Cloudflare RealtimeKit API base URL
const RTK_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

// Helper to make authenticated RealtimeKit API calls
async function rtkFetch<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: object
): Promise<{ data: T; status: number }> {
    const url = `${RTK_API_BASE}/${config.cloudflareAccountId}/realtime/kit/${config.cloudflareRtkAppId}${endpoint}`;

    console.log(`[RTK] ${method} ${endpoint}`);
    if (body) {
        console.log(`[RTK] Request body:`, JSON.stringify(body));
    }

    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${config.cloudflareApiToken}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as {
        success: boolean;
        errors?: Array<{ message: string }>;
        data?: T;
    };

    console.log(`[RTK] Response status: ${response.status}, success: ${data.success}`);
    if (data.data) {
        console.log(`[RTK] Response data:`, JSON.stringify(data.data));
    }
    if (data.errors) {
        console.log(`[RTK] Response errors:`, JSON.stringify(data.errors));
    }

    if (!response.ok || !data.success) {
        const errorMessage = data.errors?.[0]?.message || `API error: ${response.status}`;
        const error = new Error(errorMessage) as Error & { status: number };
        error.status = response.status;
        throw error;
    }

    return { data: data.data as T, status: response.status };
}

export const audioRouter = router({
    // Check if audio is available
    isAvailable: authedProcedure.query(() => {
        return { available: config.isRealtimeKitConfigured };
    }),

    // Join the audio call for a room
    joinCall: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            console.log(
                `[Audio] joinCall request - roomId: ${input.roomId}, playerId: ${ctx.playerId}`
            );

            const room = await getRoomById(input.roomId);

            if (!room) {
                console.log(`[Audio] Room not found: ${input.roomId}`);
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
            }

            const player = room.players.find((p) => p.id === ctx.playerId);
            if (!player) {
                console.log(`[Audio] Player not found in room: ${ctx.playerId}`);
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
            }

            console.log(`[Audio] Player: ${player.name}, isHost: ${player.isHost}`);

            if (!config.isRealtimeKitConfigured) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Voice chat requires Cloudflare RealtimeKit configuration',
                });
            }

            try {
                // Get existing meeting or create one atomically
                let meetingId = await getMeetingId(input.roomId);
                console.log(`[Audio] Current meeting in Redis: ${meetingId || 'none'}`);

                if (!meetingId) {
                    // No meeting exists - create one
                    console.log(`[Audio] Creating new meeting for room ${room.code}`);

                    const meeting = await rtkFetch<{ id: string }>('/meetings', 'POST', {
                        title: `Imposter Room ${room.code}`,
                    });

                    // Try to save atomically - if another request already saved one, use that instead
                    const saved = await saveMeetingIdIfNotExists(input.roomId, meeting.data.id);
                    console.log(
                        `[Audio] saveMeetingIdIfNotExists result: ${saved}, meetingId: ${meeting.data.id}`
                    );

                    if (saved) {
                        meetingId = meeting.data.id;
                        console.log(`[Audio] Created and saved new meeting: ${meetingId}`);
                    } else {
                        // Another request beat us - use the existing meeting
                        meetingId = await getMeetingId(input.roomId);
                        console.log(`[Audio] Using existing meeting from Redis: ${meetingId}`);
                        if (!meetingId) {
                            throw new Error('Failed to get or create meeting');
                        }
                    }
                } else {
                    console.log(`[Audio] Using cached meeting: ${meetingId}`);
                }

                // Add participant to the meeting
                console.log(`[Audio] Adding participant ${player.name} to meeting ${meetingId}`);

                const presetName = player.isHost ? 'imp_game_vc_host' : 'imp_game_vc_participant';
                console.log(`[Audio] Using preset: ${presetName}`);

                const participant = await rtkFetch<{ id: string; token: string }>(
                    `/meetings/${meetingId}/participants`,
                    'POST',
                    {
                        custom_participant_id: ctx.playerId,
                        preset_name: presetName,
                        name: player.name,
                    }
                );

                console.log(`[Audio] Participant added successfully, id: ${participant.data.id}`);
                console.log(`[Audio] Returning auth token for meeting: ${meetingId}`);

                return {
                    authToken: participant.data.token,
                    meetingId,
                };
            } catch (error) {
                console.error('[Audio] RealtimeKit error:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to join audio call',
                });
            }
        }),

    // Leave the audio call
    leaveCall: authedProcedure
        .input(
            z.object({
                roomId: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            console.log(`[Audio] leaveCall - roomId: ${input.roomId}, playerId: ${ctx.playerId}`);
            // Client-side SDK handles disconnection
            return { success: true };
        }),
});
