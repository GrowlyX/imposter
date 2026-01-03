import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { config } from './config.js';
import { getAllCategoryNames } from './data/categories.js';
import { getReconcilerStatus, startReconciler, stopReconciler } from './lib/reconciler.js';
import { appRouter } from './router.js';

console.log(`Imposter Game Server running on http://localhost:${config.port}`);
console.log(`WebSocket available at ws://localhost:${config.port}/trpc`);
console.log(`Health check at http://localhost:${config.port}/health`);

// Bun HTTP server with WebSocket support
const server = Bun.serve({
    port: config.port,
    async fetch(req, server) {
        const url = new URL(req.url);

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, x-player-id, x-room-id',
                },
            });
        }

        // Health check
        if (url.pathname === '/health') {
            const reconcilerStatus = getReconcilerStatus();
            return Response.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                realtimeKitConfigured: config.isRealtimeKitConfigured,
                reconciler: reconcilerStatus,
            });
        }

        // Get available categories
        if (url.pathname === '/api/categories') {
            return Response.json(getAllCategoryNames(), {
                headers: { 'Access-Control-Allow-Origin': '*' },
            });
        }

        // Handle WebSocket upgrade for tRPC subscriptions
        if (url.pathname === '/trpc' && req.headers.get('upgrade') === 'websocket') {
            const upgraded = server.upgrade(req, {
                data: {
                    playerId: req.headers.get('x-player-id'),
                    roomId: req.headers.get('x-room-id'),
                },
            });
            if (!upgraded) {
                return new Response('WebSocket upgrade failed', { status: 426 });
            }
            return undefined;
        }

        // Handle tRPC HTTP requests
        if (url.pathname.startsWith('/trpc')) {
            const response = await fetchRequestHandler({
                endpoint: '/trpc',
                req,
                router: appRouter,
                createContext: () => ({
                    playerId: req.headers.get('x-player-id'),
                    roomId: req.headers.get('x-room-id'),
                }),
            });

            // Add CORS headers
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        }

        return new Response('Not Found', { status: 404 });
    },
    websocket: {
        open(ws) {
            console.log('WebSocket connection opened');
        },
        message(ws, message) {
            // WebSocket message handling for tRPC subscriptions
            // In production, you'd integrate with @trpc/server/adapters/ws
            console.log('WebSocket message received:', message);
        },
        close(ws) {
            console.log('WebSocket connection closed');
        },
    },
});

// Start the reconciler for distributed meeting cleanup
startReconciler();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await stopReconciler();
    server.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Shutting down (SIGINT)...');
    await stopReconciler();
    server.stop();
    process.exit(0);
});
