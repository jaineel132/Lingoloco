import { NextResponse } from 'next/server';
import { buildProgressSummary, type ProgressSnapshot } from '../../../lib/progress';
import { createSupabaseServerClient, getSupabaseUser } from '../../../lib/supabase/server';
import { fetchGroq } from '../../../lib/groq';

export const dynamic = 'force-dynamic';

type RecommendationPayload = {
  headline: string;
  summary: string;
  sessionId: number;
  setId: number;
  sessionLabel: string;
  setLabel: string;
  estimatedMinutes: number;
  focusPoints: string[];
  whyThisWorks: string;
  nextActionLabel: string;
};

function stripCodeFences(text: string) {
  return text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
}

function fallbackRecommendation(progress: ReturnType<typeof buildProgressSummary>): RecommendationPayload {
  return {
    headline: 'AI picked your next lesson',
    summary: 'Keep momentum with the next unfinished session and a focused set built around your current progress.',
    sessionId: progress.practiceRoadmap.currentSessionId,
    setId: progress.practiceRoadmap.currentSetId,
    sessionLabel: progress.practiceRoadmap.currentSessionLabel,
    setLabel: progress.practiceRoadmap.currentSetLabel,
    estimatedMinutes: 10,
    focusPoints: [
      'Review the last topic you touched',
      'Complete one 10-question set',
      'Finish strong to protect your streak',
    ],
    whyThisWorks: 'It follows your current roadmap state, so you continue from where your progress left off.',
    nextActionLabel: progress.practiceRoadmap.nextActionLabel,
  };
}

function parseRecommendation(text: string, progress: ReturnType<typeof buildProgressSummary>): RecommendationPayload {
  try {
    const parsed = JSON.parse(stripCodeFences(text)) as Partial<RecommendationPayload>;

    return {
      headline: parsed.headline?.trim() || 'AI picked your next lesson',
      summary: parsed.summary?.trim() || 'Continue with the next recommended set.',
      sessionId: Number.isFinite(parsed.sessionId) ? Number(parsed.sessionId) : progress.practiceRoadmap.currentSessionId,
      setId: Number.isFinite(parsed.setId) ? Number(parsed.setId) : progress.practiceRoadmap.currentSetId,
      sessionLabel: parsed.sessionLabel?.trim() || progress.practiceRoadmap.currentSessionLabel,
      setLabel: parsed.setLabel?.trim() || progress.practiceRoadmap.currentSetLabel,
      estimatedMinutes: Number.isFinite(parsed.estimatedMinutes) ? Number(parsed.estimatedMinutes) : 10,
      focusPoints: Array.isArray(parsed.focusPoints) ? parsed.focusPoints.map((item) => String(item).trim()).filter(Boolean).slice(0, 3) : [],
      whyThisWorks: parsed.whyThisWorks?.trim() || 'It matches your current progress state.',
      nextActionLabel: parsed.nextActionLabel?.trim() || progress.practiceRoadmap.nextActionLabel,
    };
  } catch {
    return fallbackRecommendation(progress);
  }
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

    const progress = buildProgressSummary(userData as ProgressSnapshot);

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ success: true, data: fallbackRecommendation(progress) }, { status: 200 });
    }

    const prompt = `You are a language-learning coach creating one recommended next step for a learner.
Learner profile:
- Name: ${userData.name}
- Target language: ${userData.targetLanguage}
- Current streak: ${progress.streak}
- XP: ${progress.xp}
- Lessons completed: ${progress.lessonsCompleted}
- Daily progress: ${progress.dailyProgressMinutes}/${progress.dailyGoalMinutes}
- Roadmap progress: ${progress.practiceRoadmap.completedSessions}/${progress.practiceRoadmap.totalSessions} sessions and ${progress.practiceRoadmap.completedSets}/${progress.practiceRoadmap.totalSets} sets
- Current next action: ${progress.practiceRoadmap.nextActionLabel}

Return ONLY a raw JSON object with this exact structure:
{
  "headline": "short title",
  "summary": "1-2 sentence explanation",
  "sessionId": 1,
  "setId": 1,
  "sessionLabel": "Session 1",
  "setLabel": "Set 1",
  "estimatedMinutes": 10,
  "focusPoints": ["point 1", "point 2", "point 3"],
  "whyThisWorks": "one short sentence",
  "nextActionLabel": "Session 1 • Set 1"
}

Choose the next most useful session/set based on the learner's current progress. Keep it beginner-friendly and specific.`;

    const responseText = await fetchGroq(prompt);
    const recommendation = parseRecommendation(responseText, progress);

    return NextResponse.json(
      { success: true, data: recommendation },
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
    console.error('Recommendation API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build AI recommendation: ' + error.message },
      { status: 500 }
    );
  }
}
