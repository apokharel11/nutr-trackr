import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Explicitly pass your project's custom environment variables
const redis = new Redis({
  url: process.env.NUTR_TRACKR_KV_REST_API_URL || '',
  token: process.env.NUTR_TRACKR_KV_REST_API_TOKEN || '',
});

const SYNC_KEY = 'macro_tracker_data_v1';

export async function GET() {
  try {
    const data = await redis.get(SYNC_KEY);
    return NextResponse.json(data ?? {});
  } catch (error: any) {
    console.error("Upstash Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await redis.set(SYNC_KEY, body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Upstash Save Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}