import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseUser } from '@/lib/supabase/server';

type SaveRoleplayBody = {
  scenarioId: string;
  targetLanguage: string;
  messageCount: number;
  userMessageCount: number;
  score: number;
  xpEarned: number;
  durationSeconds: number;
};

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as SaveRoleplayBody;

    if (!body.scenarioId || !body.targetLanguage) {
      return NextResponse.json({ success: false, error: 'scenarioId and targetLanguage are required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { error: insertError } = await supabase.from('roleplay_sessions').insert({
      user_id: user.id,
      scenario_id: body.scenarioId,
      target_language: body.targetLanguage,
      message_count: Math.max(0, Math.round(body.messageCount || 0)),
      user_message_count: Math.max(0, Math.round(body.userMessageCount || 0)),
      score: Math.max(0, Math.min(100, Math.round(body.score || 0))),
      xp_earned: Math.max(0, Math.round(body.xpEarned || 0)),
      duration_seconds: Math.max(0, Math.round(body.durationSeconds || 0)),
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Save roleplay error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to save roleplay session' }, { status: 500 });
  }
}
