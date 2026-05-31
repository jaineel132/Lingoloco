import { NextResponse } from 'next/server';
import { buildProgressSummary, type ProgressSnapshot } from '../../../lib/progress';
import { createSupabaseServerClient, getSupabaseUser } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSupabaseUser();

    if (!user?.id || !user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    let userData = existingProfile;

    if (!userData) {
      const fallbackProfile = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0] || 'Language Learner',
        image: user.user_metadata?.avatar_url || '',
        targetLanguage: 'es',
        level: 'Beginner',
        xp: 0,
        streak: 0,
        dailyGoalMinutes: 10,
        dailyProgressMinutes: 0,
        dailyXpToday: 0,
        dailyScenariosToday: 0,
        lessonsCompleted: 0,
        totalTimeHours: 0,
        lastPracticeDateKey: '',
        lastPracticeAt: null,
        practiceCompletedSetKeys: [],
        practiceCompletedSessionIds: [],
        lastPracticeSessionId: null,
        lastPracticeSetId: null,
        lastPracticeSessionLabel: '',
        lastPracticeSetLabel: '',
        squadId: null,
        squadJoinedAt: null,
      };

      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(fallbackProfile)
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      userData = insertedProfile;
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
    console.error("API Error fetching dashboard data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data: " + error.message },
      { status: 500 }
    );
  }
}
