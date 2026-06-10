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

const FALLBACK_SENTENCES: Record<string, string[]> = {
  es: [
    'El gato duerme en la silla',
    'Me gusta leer libros interesantes',
    'Voy a la playa con mis amigos',
    'La comida es muy deliciosa aqui',
    'Mañana tengo una reunion importante',
    'El sol brilla en el cielo azul',
    'Quiero aprender a hablar espanol',
    'Los estudiantes estudian en la biblioteca',
    'El perro corre rapidamente por el parque',
    'Nosotros vamos a viajar a Madrid este verano',
    'Los ninos juegan felices en el jardin',
    'Ella prepara una cena especial para la familia',
    'El profesor explica la leccion con claridad',
    'Ellos compran frutas frescas en el mercado',
    'Podemos encontrar la solucion trabajando juntos',
    'La musica clasica relaja la mente y el alma',
    'El tren sale de la estacion a las ocho',
    'Los arboles altos protegen del calor del sol',
    'El agua fresca es importante para la salud',
    'La biblioteca abre sus puertas a las nueve',
  ],
  fr: [
    'Le chat dort sur la chaise',
    'Jaime lire des livres interessants',
    'Je vais a la plage avec mes amis',
    'La nourriture est tres delicieuse ici',
    'Demain jai une reunion importante',
    'Le soleil brille dans le ciel bleu',
    'Je veux apprendre a parler francais',
    'Ma mere prepare un gateau delicieux',
    'Nous allons voyager a Paris cet ete',
    'Les enfants jouent dans le jardin',
    'Il y a un beau jardin devant la maison',
    'Le professeur explique la lecon clairement',
    'Ils achete des fruits frais au marche',
    'Nous pouvons resoudre ce probleme ensemble',
    'La musique classique apaise lesprit',
    'Le train part de la gare a huit heures',
    'Leau fraiche est importante pour la sante',
  ],
  de: [
    'Die Katze schlaft auf dem Stuhl',
    'Ich lese gerne interessante Bucher',
    'Ich gehe mit meinen Freunden zum Strand',
    'Das Essen ist hier sehr lecker',
    'Morgen habe ich eine wichtige Besprechung',
    'Die Sonne scheint am blauen Himmel',
    'Ich mochte Deutsch sprechen lernen',
    'Meine Mutter backt einen leckeren Kuchen',
    'Wir reisen diesen Sommer nach Berlin',
    'Die Kinder spielen glucklich im Garten',
    'Der Lehrer erklart die Lektion klar',
    'Sie kaufen frische Obst auf dem Markt',
    'Klassische Musik beruhigt den Geist',
  ],
  ja: [
    'Watashi wa hon o yomu no ga suki desu',
    'Kirei na hana ga niwa ni saite imasu',
    'Ashita wa juuyou na kaigi ga arimasu',
    'Taiyou ga aoi sora ni kagayaite imasu',
    'Nihongo o hanasu koto o manabitai desu',
    'Kodomo tachi ga kouen de asonde imasu',
    'Sensei ga jugyou o teinei ni setsumei shimasu',
    'Kare wa mainichi supootsu o shimasu',
    'Haha ga oishii ryouri o tsukurimashita',
  ],
};

function getFallbackChallenge(langCode: string, round: number): string {
  const pool = FALLBACK_SENTENCES[langCode] || FALLBACK_SENTENCES['es'];
  const wordCountTarget = round <= 1 ? 8 : round <= 2 ? 12 : round <= 3 ? 16 : round <= 4 ? 20 : 25;
  const candidates = pool.filter(s => {
    const count = s.split(/\s+/).length;
    return Math.abs(count - wordCountTarget) <= 3;
  });
  if (candidates.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

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
    const MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-1.5-flash'] as const;

    let sentence = '';
    const errors: string[] = [];

    for (const modelName of MODEL_CANDIDATES) {
      const model = genAI.getGenerativeModel({ model: modelName });

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          let rawText = result.response.text().trim();
          if (rawText.startsWith('```')) {
            rawText = rawText.replace(/```[a-zA-Z]*\n?/, '').replace(/\n?```/, '').trim();
          }
          sentence = rawText.replace(/^["'«“‘](.*)["'»”’]$/, '$1').trim();
          if (sentence) break;
        } catch (e: any) {
          const status = typeof e?.status === 'number' ? e.status : 0;
          const isQuotaError = status === 429;
          errors.push(`${modelName} (attempt ${attempt}): ${e?.message || e}`);

          if (status === 404 || isQuotaError) {
            break;
          }

          if (attempt >= 3) continue;
          await new Promise((r) => setTimeout(r, 300 * attempt));
        }
      }

      if (sentence) break;
    }

    if (!sentence) {
      sentence = getFallbackChallenge(langCode, roundNum);
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
    const message = error.message || String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
