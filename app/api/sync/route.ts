import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Automatically reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from your environment variables
const redis = Redis.fromEnv();
const SYNC_KEY = 'macro_tracker_data_v1';

export async function GET() {
  try {
    const data = await redis.get(SYNC_KEY);
    // Upstash implicitly parses the JSON string back into an object
    return NextResponse.json(data ?? {});
  } catch (error: any) {
    console.error("Upstash Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Upstash automatically handles stringifying objects safely
    await redis.set(SYNC_KEY, body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Upstash Save Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}