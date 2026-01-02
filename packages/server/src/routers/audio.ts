import { z } from 'zod';
import { router, authedProcedure } from '../trpc.js';
import { getRoomById, getMeetingId, saveMeetingId } from '../lib/redis.js';
import { TRPCError } from '@trpc/server';
import { config } from '../config.js';
import Cloudflare from 'cloudflare';

// Initialize Cloudflare client
function getCloudflareClient(): Cloudflare | null {
    if (!config.isRealtimeKitConfigured) {
        return null;
    }
    return new Cloudflare({
        apiToken: config.cloudflareApiToken,
    });
}

export const audioRouter = router({
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

            const client = getCloudflareClient();
            if (!client) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Audio calls not available - Cloudflare RealtimeKit not configured',
                });
            }

            try {
                // Get or create meeting for room (from Redis)
                let meetingId = await getMeetingId(input.roomId);

                if (!meetingId) {
                    // Create new meeting via Cloudflare SDK
                    const meetingResponse = await client.realtimeKit.meetings.create(
                        config.cloudflareRtkAppId!,
                        {
                            account_id: config.cloudflareAccountId!,
                            title: `Imposter Room ${room.code}`,
                        }
                    );
                    meetingId = meetingResponse.id!;
                    await saveMeetingId(input.roomId, meetingId);
                }

                // Add participant via Cloudflare SDK
                const participantResponse = await client.realtimeKit.meetings.addParticipant(
                    config.cloudflareRtkAppId!,
                    meetingId,
                    {
                        account_id: config.cloudflareAccountId!,
                        name: player.name,
                        preset_name: 'participant',
                        custom_participant_id: ctx.playerId,
                    }
                );

                return {
                    authToken: participantResponse.authToken!,
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
        .mutation(async ({ input, ctx }) => {
            // Client-side SDK handles disconnection
            // Server-side cleanup would go here if needed
            return { success: true };
        }),
});
