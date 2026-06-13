import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, getSupabaseUserFromRequest } from '@/lib/supabase/server';
import { fetchGroq } from '@/lib/groq';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

const supabaseAdmin = createSupabaseAdminClient();

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

type ChallengePair = { english: string; target: string };

const FALLBACK_SENTENCES: Record<string, ChallengePair[]> = {
  es: [
    { english: 'The cat sleeps on the chair', target: 'El gato duerme en la silla' },
    { english: 'I like reading interesting books', target: 'Me gusta leer libros interesantes' },
    { english: 'I go to the beach with my friends', target: 'Voy a la playa con mis amigos' },
    { english: 'The food is very delicious here', target: 'La comida es muy deliciosa aqui' },
    { english: 'Tomorrow I have an important meeting', target: 'Manana tengo una reunion importante' },
    { english: 'The sun shines in the blue sky', target: 'El sol brilla en el cielo azul' },
    { english: 'I want to learn to speak Spanish', target: 'Quiero aprender a hablar espanol' },
    { english: 'The students study in the library', target: 'Los estudiantes estudian en la biblioteca' },
    { english: 'The dog runs quickly through the park', target: 'El perro corre rapidamente por el parque' },
    { english: 'We are going to travel to Madrid this summer', target: 'Nosotros vamos a viajar a Madrid este verano' },
    { english: 'The children play happily in the garden', target: 'Los ninos juegan felices en el jardin' },
    { english: 'She prepares a special dinner for the family', target: 'Ella prepara una cena especial para la familia' },
    { english: 'The teacher explains the lesson clearly', target: 'El profesor explica la leccion con claridad' },
    { english: 'They buy fresh fruits at the market', target: 'Ellos compran frutas frescas en el mercado' },
    { english: 'We can find the solution working together', target: 'Podemos encontrar la solucion trabajando juntos' },
    { english: 'Classical music relaxes the mind and soul', target: 'La musica clasica relaja la mente y el alma' },
    { english: 'The train leaves the station at eight o clock', target: 'El tren sale de la estacion a las ocho' },
    { english: 'The tall trees protect from the heat of the sun', target: 'Los arboles altos protegen del calor del sol' },
    { english: 'Fresh water is important for health', target: 'El agua fresca es importante para la salud' },
    { english: 'The library opens its doors at nine o clock', target: 'La biblioteca abre sus puertas a las nueve' },
  ],
  fr: [
    { english: 'The cat sleeps on the chair', target: 'Le chat dort sur la chaise' },
    { english: 'I like reading interesting books', target: "J'aime lire des livres interessants" },
    { english: 'I go to the beach with my friends', target: 'Je vais a la plage avec mes amis' },
    { english: 'The food is very delicious here', target: 'La nourriture est tres delicieuse ici' },
    { english: 'Tomorrow I have an important meeting', target: 'Demain j ai une reunion importante' },
    { english: 'The sun shines in the blue sky', target: 'Le soleil brille dans le ciel bleu' },
    { english: 'I want to learn to speak French', target: 'Je veux apprendre a parler francais' },
    { english: 'My mother prepares a delicious cake', target: 'Ma mere prepare un gateau delicieux' },
    { english: 'We are going to travel to Paris this summer', target: 'Nous allons voyager a Paris cet ete' },
    { english: 'The children play in the garden', target: 'Les enfants jouent dans le jardin' },
    { english: 'There is a beautiful garden in front of the house', target: 'Il y a un beau jardin devant la maison' },
    { english: 'The teacher explains the lesson clearly', target: 'Le professeur explique la lecon clairement' },
    { english: 'They buy fresh fruits at the market', target: 'Ils achetent des fruits frais au marche' },
    { english: 'We can solve this problem together', target: 'Nous pouvons resoudre ce probleme ensemble' },
    { english: 'Classical music soothes the mind', target: 'La musique classique apaise lesprit' },
    { english: 'The train leaves the station at eight o clock', target: 'Le train part de la gare a huit heures' },
    { english: 'Fresh water is important for health', target: 'L eau fraiche est importante pour la sante' },
  ],
  de: [
    { english: 'The cat sleeps on the chair', target: 'Die Katze schlaft auf dem Stuhl' },
    { english: 'I like reading interesting books', target: 'Ich lese gerne interessante Bucher' },
    { english: 'I go to the beach with my friends', target: 'Ich gehe mit meinen Freunden zum Strand' },
    { english: 'The food is very delicious here', target: 'Das Essen ist hier sehr lecker' },
    { english: 'Tomorrow I have an important meeting', target: 'Morgen habe ich eine wichtige Besprechung' },
    { english: 'The sun shines in the blue sky', target: 'Die Sonne scheint am blauen Himmel' },
    { english: 'I want to learn to speak German', target: 'Ich mochte Deutsch sprechen lernen' },
    { english: 'My mother bakes a delicious cake', target: 'Meine Mutter backt einen leckeren Kuchen' },
    { english: 'We are traveling to Berlin this summer', target: 'Wir reisen diesen Sommer nach Berlin' },
    { english: 'The children play happily in the garden', target: 'Die Kinder spielen glucklich im Garten' },
    { english: 'The teacher explains the lesson clearly', target: 'Der Lehrer erklart die Lektion klar' },
    { english: 'They buy fresh fruit at the market', target: 'Sie kaufen frisches Obst auf dem Markt' },
    { english: 'Classical music calms the mind', target: 'Klassische Musik beruhigt den Geist' },
  ],
  ja: [
    { english: 'I like reading books', target: 'Watashi wa hon o yomu no ga suki desu' },
    { english: 'Beautiful flowers are blooming in the garden', target: 'Kirei na hana ga niwa ni saite imasu' },
    { english: 'Tomorrow there is an important meeting', target: 'Ashita wa juuyou na kaigi ga arimasu' },
    { english: 'The sun is shining in the blue sky', target: 'Taiyou ga aoi sora ni kagayaite imasu' },
    { english: 'I want to learn to speak Japanese', target: 'Nihongo o hanasu koto o manabitai desu' },
    { english: 'The children are playing in the park', target: 'Kodomo tachi ga kouen de asonde imasu' },
    { english: 'The teacher explains the lesson carefully', target: 'Sensei ga jugyou o teinei ni setsumei shimasu' },
    { english: 'He exercises every day', target: 'Kare wa mainichi supootsu o shimasu' },
    { english: 'My mother made a delicious meal', target: 'Haha ga oishii ryouri o tsukurimashita' },
  ],
};

function getFallbackChallenge(langCode: string, round: number, previousChallenges: string[] = []): string {
  const pool = FALLBACK_SENTENCES[langCode] || FALLBACK_SENTENCES['es'];
  const wordCountTarget = round <= 1 ? 8 : round <= 2 ? 12 : round <= 3 ? 16 : round <= 4 ? 20 : 25;
  const candidates = pool.filter(pair => {
    const count = pair.target.split(/\s+/).length;
    return Math.abs(count - wordCountTarget) <= 3 && !previousChallenges.includes(pair.target);
  });
  
  let chosen: ChallengePair;
  if (candidates.length > 0) {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    const unused = pool.filter(pair => !previousChallenges.includes(pair.target));
    if (unused.length > 0) {
      chosen = unused[Math.floor(Math.random() * unused.length)];
    } else {
      chosen = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  
  return JSON.stringify({ english: chosen.english, target: chosen.target });
}

export async function POST(req: Request) {
  try {
    const user = await getSupabaseUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(getRateLimitKey(user.id, 'generate-challenge'), 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    const body = await req.json();
    const { roomId, language, round, previousChallenges } = body;

    if (!roomId || !language || !round) {
      return NextResponse.json({ error: 'roomId, language, and round are required.' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured.' }, { status: 500 });
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

    const prompt = `You are a professional language tutor. Generate a sentence pair for a translation typing duel game.
The difficulty must correspond to Round ${roundNum}:
- Requirements: ${difficultyDesc}

Generate a natural, grammatically correct sentence in ${languageName} AND its English translation.
Ensure you DO NOT repeat or resemble these previous challenges: ${JSON.stringify(previousChallenges || [])}.

CRITICAL: Return ONLY in this exact format: ENGLISH_SENTENCE ||| TARGET_LANGUAGE_SENTENCE
Example: "Hello, how are you?" ||| "Hola, ¿cómo estás?"
Do NOT include markdown, quotes, explanations, or any other text. Just the two sentences separated by " ||| ".`;

    let sentence = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawText = await fetchGroq(prompt, { retries: 1 });
        const parts = rawText.split('|||').map((s: string) => s.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          sentence = JSON.stringify({ english: parts[0], target: parts[1] });
          break;
        }
      } catch {
        if (attempt >= 3) break;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }

    if (!sentence) {
      sentence = getFallbackChallenge(langCode, roundNum, previousChallenges || []);
    }

    if (!sentence) {
      throw new Error('Failed to generate any challenge (neither Gemini nor fallback produced a sentence)');
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

    let challengePair: ChallengePair;
    try {
      challengePair = JSON.parse(sentence);
    } catch {
      challengePair = { english: sentence, target: sentence };
    }

    return NextResponse.json({
      success: true,
      english: challengePair.english,
      target: challengePair.target,
    });
  } catch (error: any) {
    console.error('Generate Challenge API error:', error);
    const message = error.message || String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
