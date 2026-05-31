import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseUserFromRequest } from '../../../lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await getSupabaseUserFromRequest(request);

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    const onboardingPayload = {
      userId: user.id,
      courseId: String(body.courseId || 'es'),
      level: String(body.level || 'Beginner'),
      commitment: Number(body.commitment || 10),
      remindersEnabled: Boolean(body.remindersEnabled),
      reminderTime: body.reminderTime ? String(body.reminderTime) : '',
    };

    const { data: onboardingRecord, error: onboardingError } = await supabase
      .from('onboarding_profiles')
      .upsert(onboardingPayload, { onConflict: 'userId' })
      .select('*')
      .single();

    if (onboardingError) {
      throw onboardingError;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        targetLanguage: onboardingPayload.courseId,
        level: onboardingPayload.level,
        dailyGoalMinutes: onboardingPayload.commitment,
      })
      .eq('id', user.id);

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json(
      { success: true, data: onboardingRecord },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API Error connecting or saving:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process form submission: " + error.message },
      { status: 500 }
    );
  }
}
