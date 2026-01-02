import { router } from './trpc.js';
import { roomRouter } from './routers/room.js';
import { gameRouter } from './routers/game.js';
import { chatRouter } from './routers/chat.js';
import { audioRouter } from './routers/audio.js';

export const appRouter = router({
    room: roomRouter,
    game: gameRouter,
    chat: chatRouter,
    audio: audioRouter,
});

export type AppRouter = typeof appRouter;
