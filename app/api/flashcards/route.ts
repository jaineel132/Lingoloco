import { NextResponse } from 'next/server';
import { getSupabaseUser } from '../../../lib/supabase/server';
import { fetchGroq } from '../../../lib/groq';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit';

type FlashcardRequest = {
  lang?: string;
  languageName?: string;
  count?: number;
};

type Flashcard = {
  id: number;
  word: string;
  pronunciation: string;
  translation: string;
  example: string;
  lang: string;
};

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

const FALLBACK_FLASHCARDS: Flashcard[] = [
  { id: 1, word: 'Buenos dias', pronunciation: 'bweh-nos dee-as', translation: 'Good morning', example: 'Buenos dias, profesor.', lang: 'Spanish' },
  { id: 2, word: 'Comida', pronunciation: 'ko-mee-da', translation: 'Food', example: 'La comida esta lista.', lang: 'Spanish' },
  { id: 3, word: 'Escuela', pronunciation: 'es-kweh-la', translation: 'School', example: 'Voy a la escuela.', lang: 'Spanish' },
  { id: 4, word: 'Trabajo', pronunciation: 'tra-ba-ho', translation: 'Work', example: 'Tengo mucho trabajo hoy.', lang: 'Spanish' },
  { id: 5, word: 'Familia', pronunciation: 'fa-mee-lya', translation: 'Family', example: 'Mi familia vive cerca.', lang: 'Spanish' },
];

function stripCodeFences(text: string) {
  if (text.startsWith('```json')) {
    return text.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
  }

  if (text.startsWith('```')) {
    return text.replace(/```\n?/, '').replace(/\n?```/, '').trim();
  }

  return text.trim();
}

function compactText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFlashcards(payload: unknown, languageName: string, count: number): Flashcard[] {
  if (!Array.isArray(payload)) {
    throw new Error('AI response must be an array');
  }

  const cards = payload
    .map((item, index) => {
      const raw = item as Record<string, unknown>;
      const word = compactText(raw.word);
      const pronunciation = compactText(raw.pronunciation);
      const translation = compactText(raw.translation);
      const example = compactText(raw.example);

      if (!word || !translation || !example) {
        return null;
      }

      return {
        id: index + 1,
        word,
        pronunciation: pronunciation || 'n/a',
        translation,
        example,
        lang: languageName,
      };
    })
    .filter((item): item is Flashcard => Boolean(item));

  const uniqueByWord = Array.from(new Map(cards.map((card) => [card.word.toLowerCase(), card])).values());

  if (uniqueByWord.length < count) {
    throw new Error(`AI response must contain at least ${count} unique flashcards, received ${uniqueByWord.length}`);
  }

  return uniqueByWord.slice(0, count).map((card, index) => ({ ...card, id: index + 1 }));
}

export async function GET(request: Request) {
  try {
    const user = await getSupabaseUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(getRateLimitKey(user.id, 'flashcards'), 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please wait before generating more flashcards.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const body: FlashcardRequest = {
      lang: searchParams.get('lang') || 'es',
      languageName: searchParams.get('languageName') || '',
      count: Number(searchParams.get('count') || 5),
    };

    const lang = compactText(body.lang) || 'es';
    const languageName = compactText(body.languageName) || LANGUAGE_NAMES[lang] || 'Spanish';
    const count = Math.max(3, Math.min(10, Math.round(body.count || 5)));

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ success: true, data: FALLBACK_FLASHCARDS.slice(0, count) }, { status: 200 });
    }

    const prompt = `You are a beginner language tutor.
Create exactly ${count} unique flashcards for learners studying ${languageName} (${lang}).
Output ONLY a raw JSON array. No markdown.

Each object must include:
- word: a single useful word or short phrase in ${languageName}
- pronunciation: a simple Latin pronunciation guide
- translation: English meaning
- example: one short beginner example sentence using the word in ${languageName}

Rules:
- Keep vocabulary practical and varied (greetings, daily life, food, travel, school, work).
- Avoid repeating words.
- Keep examples short and clear.

Return format:
[
  {
    "word": "...",
    "pronunciation": "...",
    "translation": "...",
    "example": "..."
  }
]`;

    const text = await fetchGroq(prompt, { retries: 3 });
    const parsed = JSON.parse(stripCodeFences(text));
    const cards = normalizeFlashcards(parsed, languageName, count);

    return NextResponse.json(
      { success: true, data: cards },
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
    console.error('Flashcards API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate flashcards: ' + error.message },
      { status: 500 }
    );
  }
}
