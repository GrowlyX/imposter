// Helper functions for tRPC API calls

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

export async function trpcQuery<T>(
    procedure: string,
    input: object,
    headers?: Record<string, string>
): Promise<T> {
    const batchInput = JSON.stringify({ '0': { json: input } });
    const url = `${SERVER_URL}/trpc/${procedure}?batch=1&input=${encodeURIComponent(batchInput)}`;

    const response = await fetch(url, {
        headers: {
            ...headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData[0]?.error?.json?.message || `Failed to call ${procedure}`);
    }

    const data = await response.json();
    return data[0]?.result?.data?.json;
}

export async function trpcMutation<T>(
    procedure: string,
    input: object,
    headers?: Record<string, string>
): Promise<T> {
    const url = `${SERVER_URL}/trpc/${procedure}?batch=1`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify({ '0': { json: input } }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData[0]?.error?.json?.message || `Failed to call ${procedure}`);
    }

    const data = await response.json();
    return data[0]?.result?.data?.json;
}
