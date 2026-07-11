import Redis from 'ioredis';
import { NextResponse } from 'next/server';

const redis = new Redis(process.env.PRIMARY_STORAGE_REDIS_URL || '');
const SYNC_KEY = 'macro_tracker_data_v1';

export async function GET() {
  try {
    const data = await redis.get(SYNC_KEY);
    return NextResponse.json(data ? JSON.parse(data) : {});
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await redis.set(SYNC_KEY, JSON.stringify(body));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}