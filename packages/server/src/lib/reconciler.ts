import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { deleteMeetingId, getMeetingId, getRoomById, redis } from './redis.js';

// Leader election constants
const LEADER_KEY = 'reconciler:leader';
const LEADER_TTL_SECONDS = 3;
const HEARTBEAT_INTERVAL_MS = 1000;
const RECONCILIATION_INTERVAL_MS = 1000;

// Unique server instance ID
const SERVER_ID = nanoid(10);

// Cloudflare RealtimeKit API
const RTK_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

// State
let isLeader = false;
let leadershipInterval: NodeJS.Timeout | null = null;
let reconciliationInterval: NodeJS.Timeout | null = null;

/**
 * Try to acquire leadership using Redis SETNX with TTL
 */
async function tryAcquireLeadership(): Promise<boolean> {
    // SET key value NX EX seconds - atomic set if not exists with expiry
    const result = await redis.set(LEADER_KEY, SERVER_ID, 'EX', LEADER_TTL_SECONDS, 'NX');
    return result === 'OK';
}

/**
 * Renew leadership lease by extending TTL
 * Only works if we're still the leader
 */
async function renewLeadership(): Promise<boolean> {
    // Check if we're still the leader
    const currentLeader = await redis.get(LEADER_KEY);
    if (currentLeader !== SERVER_ID) {
        return false;
    }

    // Extend the TTL
    await redis.expire(LEADER_KEY, LEADER_TTL_SECONDS);
    return true;
}

/**
 * Step down from leadership
 */
async function stepDown(): Promise<void> {
    if (!isLeader) return;

    console.log(`[Reconciler] Server ${SERVER_ID} stepping down from leadership`);
    isLeader = false;

    // Only delete if we're still the leader
    const currentLeader = await redis.get(LEADER_KEY);
    if (currentLeader === SERVER_ID) {
        await redis.del(LEADER_KEY);
    }

    if (reconciliationInterval) {
        clearInterval(reconciliationInterval);
        reconciliationInterval = null;
    }
}

/**
 * Get all meeting-to-room mappings from Redis
 */
async function getAllMeetingRoomIds(): Promise<string[]> {
    const roomIds: string[] = [];
    let cursor = '0';

    do {
        const result = await redis.scan(cursor, 'MATCH', 'meeting:*', 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];

        for (const key of keys) {
            // Extract room ID from key (format: meeting:{roomId})
            const roomId = key.replace('meeting:', '');
            roomIds.push(roomId);
        }
    } while (cursor !== '0');

    return roomIds;
}

/**
 * Delete a Cloudflare meeting via API
 */
async function deleteCloudfareMeeting(meetingId: string): Promise<boolean> {
    if (!config.isRealtimeKitConfigured) return false;

    try {
        const url = `${RTK_API_BASE}/${config.cloudflareAccountId}/realtime/kit/${config.cloudflareRtkAppId}/meetings/${meetingId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${config.cloudflareApiToken}`,
                'Content-Type': 'application/json',
            },
        });

        return response.ok;
    } catch (error) {
        console.error(`[Reconciler] Failed to delete Cloudflare meeting ${meetingId}:`, error);
        return false;
    }
}

/**
 * Run reconciliation - sync meetings with active games
 */
async function runReconciliation(): Promise<void> {
    if (!isLeader) return;

    try {
        // Get all rooms with meetings
        const meetingRoomIds = await getAllMeetingRoomIds();

        let cleaned = 0;

        for (const roomId of meetingRoomIds) {
            const room = await getRoomById(roomId);

            // Check if room needs its meeting cleaned up
            const shouldDeleteMeeting =
                !room || // Room doesn't exist (stale)
                room.state === 'lobby'; // Game ended, back in lobby

            if (shouldDeleteMeeting) {
                const meetingId = await getMeetingId(roomId);

                if (meetingId) {
                    // Delete from Cloudflare
                    await deleteCloudfareMeeting(meetingId);

                    // Delete from Redis
                    await deleteMeetingId(roomId);

                    cleaned++;
                    console.log(
                        `[Reconciler] Cleaned up meeting for room ${roomId} (${room ? 'lobby state' : 'stale room'})`
                    );
                }
            }
        }

        if (cleaned > 0) {
            console.log(`[Reconciler] Reconciliation complete: cleaned ${cleaned} stale meetings`);
        }
    } catch (error) {
        console.error('[Reconciler] Error during reconciliation:', error);
    }
}

/**
 * Leadership heartbeat loop
 */
async function leadershipHeartbeat(): Promise<void> {
    if (isLeader) {
        // Try to renew our leadership
        const renewed = await renewLeadership();

        if (!renewed) {
            console.log(`[Reconciler] Server ${SERVER_ID} lost leadership`);
            await stepDown();
        }
    } else {
        // Try to acquire leadership
        const acquired = await tryAcquireLeadership();

        if (acquired) {
            console.log(`[Reconciler] Server ${SERVER_ID} acquired leadership`);
            isLeader = true;

            // Start reconciliation loop
            if (!reconciliationInterval) {
                reconciliationInterval = setInterval(runReconciliation, RECONCILIATION_INTERVAL_MS);
                // Run immediately
                runReconciliation();
            }
        }
    }
}

/**
 * Start the reconciler system
 */
export function startReconciler(): void {
    console.log(`[Reconciler] Starting reconciler with server ID: ${SERVER_ID}`);

    // Start leadership election loop
    leadershipInterval = setInterval(leadershipHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Try to acquire leadership immediately
    leadershipHeartbeat();
}

/**
 * Stop the reconciler system (for graceful shutdown)
 */
export async function stopReconciler(): Promise<void> {
    console.log(`[Reconciler] Stopping reconciler`);

    if (leadershipInterval) {
        clearInterval(leadershipInterval);
        leadershipInterval = null;
    }

    await stepDown();
}

/**
 * Get current leadership status (for debugging/monitoring)
 */
export function getReconcilerStatus(): { serverId: string; isLeader: boolean } {
    return { serverId: SERVER_ID, isLeader };
}
