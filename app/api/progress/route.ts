import { NextResponse } from 'next/server';
import { applyPracticeCompletion, buildProgressSummary, type ProgressSnapshot } from '../../../lib/progress';
import { createSupabaseServerClient, getSupabaseUser } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

type ProgressRequestBody = {
  activityType?: 'practice' | 'flashcard' | 'roleplay';
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

    const activityType = body.activityType || 'practice';
    const now = new Date().toISOString();
    const todayKey = new Date().toISOString().slice(0, 10);
    const prevKey = (currentProfile as ProgressSnapshot).lastPracticeDateKey || '';
    const isSameDay = prevKey === todayKey;

    let updates: Record<string, unknown>;

    if (activityType === 'practice') {
      const practiceUpdates = applyPracticeCompletion(currentProfile as ProgressSnapshot, {
        sessionMinutes: Number.isFinite(body.sessionMinutes ?? NaN) ? Number(body.sessionMinutes) : 10,
        xpEarned: calculateXpEarned(body),
        sessionId: Number.isFinite(body.sessionId ?? NaN) ? Number(body.sessionId) : 1,
        setId: Number.isFinite(body.setId ?? NaN) ? Number(body.setId) : 1,
        sessionLabel: body.sessionLabel,
        setLabel: body.setLabel,
        totalSessions: Number.isFinite(body.totalSessions ?? NaN) ? Number(body.totalSessions) : 10,
        setsPerSession: Number.isFinite(body.setsPerSession ?? NaN) ? Number(body.setsPerSession) : 7,
      });
      updates = {
        xp: practiceUpdates.xp,
        streak: practiceUpdates.streak,
        dailyProgressMinutes: practiceUpdates.dailyProgressMinutes,
        dailyXpToday: practiceUpdates.dailyXpToday,
        dailyScenariosToday: practiceUpdates.dailyScenariosToday,
        lessonsCompleted: practiceUpdates.lessonsCompleted,
        totalTimeHours: practiceUpdates.totalTimeHours,
        lastPracticeDateKey: practiceUpdates.lastPracticeDateKey,
        lastPracticeAt: practiceUpdates.lastPracticeAt,
        practiceCompletedSetKeys: practiceUpdates.practiceCompletedSetKeys,
        practiceCompletedSessionIds: practiceUpdates.practiceCompletedSessionIds,
        lastPracticeSessionId: practiceUpdates.lastPracticeSessionId,
        lastPracticeSetId: practiceUpdates.lastPracticeSetId,
        lastPracticeSessionLabel: practiceUpdates.lastPracticeSessionLabel,
        lastPracticeSetLabel: practiceUpdates.lastPracticeSetLabel,
      };
    } else {
      const xpGain = calculateXpEarned(body);
      const prevXp = currentProfile.xp || 0;
      const prevDailyXp = isSameDay ? (currentProfile.dailyXpToday || 0) : 0;
      const prevDailyScenarios = isSameDay ? (currentProfile.dailyScenariosToday || 0) : 0;
      const prevDailyMinutes = isSameDay ? (currentProfile.dailyProgressMinutes || 0) : 0;
      const prevStreak = currentProfile.streak || 0;
      const prevLessons = currentProfile.lessonsCompleted || 0;
      const prevHours = currentProfile.totalTimeHours || 0;
      const sessionMinutes = Math.max(1, Math.round(body.sessionMinutes ?? 5));
      const isConsecutiveDay = (() => {
        if (!prevKey) return true;
        const prev = new Date(`${prevKey}T00:00:00Z`);
        const curr = new Date(`${todayKey}T00:00:00Z`);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 1;
      })();

      updates = {
        xp: prevXp + xpGain,
        streak: isSameDay ? prevStreak : isConsecutiveDay ? prevStreak + 1 : 1,
        dailyProgressMinutes: prevDailyMinutes + sessionMinutes,
        dailyXpToday: prevDailyXp + xpGain,
        dailyScenariosToday: prevDailyScenarios + 1,
        lessonsCompleted: prevLessons + 1,
        totalTimeHours: Number((prevHours + sessionMinutes / 60).toFixed(2)),
        lastPracticeDateKey: todayKey,
        lastPracticeAt: now,
      };
    }

    const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', user.id);

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
