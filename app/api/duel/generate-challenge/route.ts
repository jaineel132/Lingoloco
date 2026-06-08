import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  ja: 'Japanese',
  de: 'German',
  it: 'Italian',
  kr: 'Korean',
  zh: 'Chinese',
  pt: 'Portuguese',
  ru: 'Russian',
  hi: 'Hindi',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, language, round, previousChallenges } = body;

    if (!roomId || !language || !round) {
      return NextResponse.json({ error: 'roomId, language, and round are required.' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const langCode = String(language).trim().toLowerCase();
    const languageName = LANGUAGE_NAMES[langCode] || language;

    const roundNum = Number(round);
    let difficultyDesc = '';
    if (roundNum === 1) {
      difficultyDesc = '6-8 words, simple everyday vocabulary for beginners.';
    } else if (roundNum === 2) {
      difficultyDesc = '10-12 words, standard vocabulary and structure.';
    } else if (roundNum === 3) {
      difficultyDesc = '14-16 words, standard grammatical structures, containing punctuation like commas, periods, or question marks.';
    } else if (roundNum === 4) {
      difficultyDesc = '18-20 words, natural conversational length, incorporating standard accents or special characters where applicable in the language.';
    } else {
      difficultyDesc = '22-25 words, advanced difficulty, complex sentence structure.';
    }

    const prompt = `You are a professional language tutor. Generate a sentence in ${languageName} for a typing duel game.
The difficulty of the sentence must correspond to Round ${roundNum}:
- Requirements: ${difficultyDesc}

Make sure it's a natural, grammatically correct sentence in ${languageName}.
Ensure that you DO NOT repeat or resemble these previous challenges: ${JSON.stringify(previousChallenges || [])}.

CRITICAL: Return ONLY the raw generated sentence in ${languageName}. Do NOT translate it to English, do NOT include markdown formatting, do NOT include quotation marks, do NOT provide explanations, and do NOT include any other text whatsoever. Just the sentence itself.`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let sentence = '';
    let attempt = 0;
    while (attempt < 3) {
      try {
        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim();
        // Clean up quotes or markdown code block wrapper if Gemini wraps it
        if (rawText.startsWith('```')) {
          rawText = rawText.replace(/```[a-zA-Z]*\n?/, '').replace(/\n?```/, '').trim();
        }
        sentence = rawText.replace(/^["'«“‘](.*)["'»”’]$/, '$1').trim();
        if (sentence) break;
      } catch (e) {
        attempt++;
        if (attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }

    if (!sentence) {
      throw new Error('Gemini failed to generate a valid sentence.');
    }

    // Save sentence to the duel room and reset round state for active play
    const { error: updateError } = await supabaseAdmin
      .from('duel_rooms')
      .update({
        current_challenge: sentence,
        status: 'in_progress',
        current_round: roundNum,
        player1_round_time: null,
        player2_round_time: null,
        round_winner_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, challenge: sentence });
  } catch (error: any) {
    console.error('Generate Challenge API error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}

export const runtime = 'edge';
