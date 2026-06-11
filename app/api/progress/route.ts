import { NextResponse } from 'next/server';
import { applyPracticeCompletion, buildProgressSummary, type ProgressSnapshot } from '../../../lib/progress';
import { createSupabaseServerClient, getSupabaseUser } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

type ProgressRequestBody = {
  sessionMinutes?: number;
  xpEarned?: number;
  score?: number;
  totalQuestions?: number;
  sessionId?: number;
  setId?: number;
  sessionLabel?: string;
  setLabel?: string;
  totalSessions?: number;
  setsPerSession?: number;
};

function calculateXpEarned(body: ProgressRequestBody) {
  if (typeof body.xpEarned === 'number' && Number.isFinite(body.xpEarned)) {
    return Math.max(0, Math.round(body.xpEarned));
  }

  const score = Math.max(0, Math.round(body.score ?? 0));
  const totalQuestions = Math.max(1, Math.round(body.totalQuestions ?? 10));
  const completionRatio = Math.min(1, score / totalQuestions);
  const baseXp = 10 + Math.round(completionRatio * 30);
  const perfectBonus = score === totalQuestions ? 10 : 0;

  return baseXp + perfectBonus;
}

export async function GET() {
  try {
    const user = await getSupabaseUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: userData, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (error) {
      throw error;
    }

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User profile not found in database.' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: { ...userData, progressSummary: buildProgressSummary(userData as ProgressSnapshot) } },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('API Error fetching progress:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch progress: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = (await request.json()) as ProgressRequestBody;
    const supabase = await createSupabaseServerClient();
    const { data: currentProfile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!currentProfile) {
      return NextResponse.json({ success: false, error: 'User profile not found in database.' }, { status: 404 });
    }

    const updates = applyPracticeCompletion(currentProfile as ProgressSnapshot, {
      sessionMinutes: Number.isFinite(body.sessionMinutes ?? NaN) ? Number(body.sessionMinutes) : 10,
      xpEarned: calculateXpEarned(body),
      sessionId: Number.isFinite(body.sessionId ?? NaN) ? Number(body.sessionId) : 1,
      setId: Number.isFinite(body.setId ?? NaN) ? Number(body.setId) : 1,
      sessionLabel: body.sessionLabel,
      setLabel: body.setLabel,
      totalSessions: Number.isFinite(body.totalSessions ?? NaN) ? Number(body.totalSessions) : 10,
      setsPerSession: Number.isFinite(body.setsPerSession ?? NaN) ? Number(body.setsPerSession) : 7,
    });

    const { error: updateError } = await supabase.from('profiles').update({
      xp: updates.xp,
      streak: updates.streak,
      dailyProgressMinutes: updates.dailyProgressMinutes,
      dailyXpToday: updates.dailyXpToday,
      dailyScenariosToday: updates.dailyScenariosToday,
      lessonsCompleted: updates.lessonsCompleted,
      totalTimeHours: updates.totalTimeHours,
      lastPracticeDateKey: updates.lastPracticeDateKey,
      lastPracticeAt: updates.lastPracticeAt,
      practiceCompletedSetKeys: updates.practiceCompletedSetKeys,
      practiceCompletedSessionIds: updates.practiceCompletedSessionIds,
      lastPracticeSessionId: updates.lastPracticeSessionId,
      lastPracticeSetId: updates.lastPracticeSetId,
      lastPracticeSessionLabel: updates.lastPracticeSessionLabel,
      lastPracticeSetLabel: updates.lastPracticeSetLabel,
    }).eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    const { data: savedUser, error: refetchError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (refetchError) {
      throw refetchError;
    }

    if (!savedUser) {
      return NextResponse.json({ success: false, error: 'Profile not found after update.' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, data: { ...savedUser, progressSummary: buildProgressSummary(savedUser) } },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('API Error saving progress:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save progress: ' + error.message },
      { status: 500 }
    );
  }
}
