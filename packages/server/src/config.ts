import { nanoid } from 'nanoid';
import { z } from 'zod';

// Generate a unique server ID if not provided
const generatedServerId = nanoid(8);

// Environment configuration schema
const configSchema = z.object({
    PORT: z.coerce.number().default(3001),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    SERVER_ID: z.string().default(generatedServerId),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    CLOUDFLARE_RTK_APP_ID: z.string().optional(),
});

export type ConfigType = z.infer<typeof configSchema>;

class Config {
    private static instance: Config;
    private config: ConfigType;

    private constructor() {
        const result = configSchema.safeParse({
            PORT: process.env.PORT,
            REDIS_URL: process.env.REDIS_URL,
            SERVER_ID: process.env.SERVER_ID,
            CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
            CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
            CLOUDFLARE_RTK_APP_ID: process.env.CLOUDFLARE_RTK_APP_ID,
        });

        if (!result.success) {
            console.error('Configuration validation failed:', result.error.format());
            throw new Error('Invalid configuration');
        }

        this.config = result.data;
    }

    public static getInstance(): Config {
        if (!Config.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }

    get port(): number {
        return this.config.PORT;
    }

    get redisUrl(): string {
        return this.config.REDIS_URL;
    }

    get serverId(): string {
        return this.config.SERVER_ID;
    }

    get cloudflareAccountId(): string | undefined {
        return this.config.CLOUDFLARE_ACCOUNT_ID;
    }

    get cloudflareApiToken(): string | undefined {
        return this.config.CLOUDFLARE_API_TOKEN;
    }

    get cloudflareRtkAppId(): string | undefined {
        return this.config.CLOUDFLARE_RTK_APP_ID;
    }

    get isRealtimeKitConfigured(): boolean {
        return !!(
            this.config.CLOUDFLARE_ACCOUNT_ID &&
            this.config.CLOUDFLARE_API_TOKEN &&
            this.config.CLOUDFLARE_RTK_APP_ID
        );
    }
}

export const config = Config.getInstance();
