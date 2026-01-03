import { audioRouter } from './routers/audio.js';
import { chatRouter } from './routers/chat.js';
import { gameRouter } from './routers/game.js';
import { roomRouter } from './routers/room.js';
import { router } from './trpc.js';

export const appRouter = router({
    room: roomRouter,
    game: gameRouter,
    chat: chatRouter,
    audio: audioRouter,
});

export type AppRouter = typeof appRouter;
