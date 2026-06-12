import { NextResponse } from 'next/server';
import { getSupabaseUser } from '../../../lib/supabase/server';
import { fetchGroq } from '../../../lib/groq';

type PracticeType = 'multiple_choice' | 'fill_in_the_blank' | 'matching' | 'reorder_sentence' | 'translation';

type PracticeRequest = {
  topic?: string;
  lang?: string;
  languageName?: string;
  section?: string;
};

type PracticeQuestion = {
  type: PracticeType;
  title: string;
  scenario: string;
  question: string;
  audioText: string;
  options?: string[];
  words?: string[];
  answer: string;
  acceptedAnswers?: string[];
  explanation: string;
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

const FALLBACK_QUESTIONS: PracticeQuestion[] = [
  {
    type: 'multiple_choice',
    title: 'Choose the greeting',
    scenario: 'You meet someone for the first time.',
    question: 'Which phrase should you say?',
    audioText: 'Hello',
    options: ['Hello', 'Goodbye', 'Please', 'Thanks'],
    answer: 'Hello',
    explanation: 'This is the correct greeting when meeting someone.',
  },
  {
    type: 'fill_in_the_blank',
    title: 'Complete the sentence',
    scenario: 'You want to ask politely.',
    question: '___, can you help me?',
    audioText: 'Please, can you help me?',
    options: ['Please', 'No', 'Here', 'Soon'],
    answer: 'Please',
    explanation: 'The polite word belongs in the blank.',
  },
  {
    type: 'matching',
    title: 'Match the meaning',
    scenario: 'You are learning core vocabulary.',
    question: 'Choose the English meaning.',
    audioText: 'Good morning',
    options: ['Good morning', 'Book', 'Water', 'Table'],
    answer: 'Good morning',
    explanation: 'This is the correct match.',
  },
  {
    type: 'reorder_sentence',
    title: 'Put the words in order',
    scenario: 'You want to introduce yourself.',
    question: 'Arrange the words to make a correct sentence.',
    audioText: 'I am a student.',
    words: ['a', 'student', 'am', 'I'],
    answer: 'I am a student',
    explanation: 'This is the natural word order.',
  },
  {
    type: 'translation',
    title: 'Translation',
    scenario: 'You need to ask for water politely.',
    question: 'Translate: I would like water, please.',
    audioText: 'I would like water, please.',
    acceptedAnswers: ['I would like water, please.', 'I want water, please.'],
    answer: 'I would like water, please.',
    explanation: 'This is the beginner-friendly translation.',
  },
  {
    type: 'multiple_choice',
    title: 'Choose the number',
    scenario: 'You are ordering food.',
    question: 'Which number means "two"?',
    audioText: 'Two',
    options: ['One', 'Two', 'Three', 'Four'],
    answer: 'Two',
    explanation: 'Two is the correct number.',
  },
  {
    type: 'fill_in_the_blank',
    title: 'Complete the phrase',
    scenario: 'You want to thank someone.',
    question: '___, for your help.',
    audioText: 'Thank you, for your help.',
    options: ['Thank you', 'Goodbye', 'Maybe', 'Later'],
    answer: 'Thank you',
    explanation: 'Thank you expresses gratitude.',
  },
  {
    type: 'matching',
    title: 'Match the color',
    scenario: 'You are describing objects.',
    question: 'Choose the color.',
    audioText: 'Red',
    options: ['Red', 'Big', 'Fast', 'Tall'],
    answer: 'Red',
    explanation: 'Red is a color word.',
  },
  {
    type: 'reorder_sentence',
    title: 'Build the question',
    scenario: 'You need to ask a question.',
    question: 'Put the words in order.',
    audioText: 'Where is the bathroom?',
    words: ['the', 'Where', 'is', 'bathroom', '?'],
    answer: 'Where is the bathroom?',
    explanation: 'This is the correct question word order.',
  },
  {
    type: 'translation',
    title: 'Translate the greeting',
    scenario: 'You are greeting someone.',
    question: 'Translate: How are you?',
    audioText: 'How are you?',
    acceptedAnswers: ['How are you?', "How're you?"],
    answer: 'How are you?',
    explanation: 'This is a common greeting.',
  },
];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Shuffle fallback question options so answer isn't always first
for (const q of FALLBACK_QUESTIONS) {
  if (q.options && q.options.length > 1) {
    q.options = shuffleArray(q.options);
  }
  if (q.words && q.words.length > 1) {
    q.words = shuffleArray(q.words);
  }
}

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

function normalizeOptions(value: unknown, answer: string, section: string) {
  const options = Array.isArray(value)
    ? value.map((option) => compactText(option)).filter(Boolean)
    : [];

  const allOptions = [answer, ...options.filter((opt) => opt !== answer)];
  while (allOptions.length < 4) {
    allOptions.push(`${section} option ${allOptions.length + 1}`);
  }

  const uniqueOptions = Array.from(new Set(allOptions)).slice(0, 4);

  // Fisher-Yates shuffle so the correct answer isn't always at position 0
  for (let i = uniqueOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueOptions[i], uniqueOptions[j]] = [uniqueOptions[j], uniqueOptions[i]];
  }

  return uniqueOptions;
}

function normalizeWords(value: unknown, answer: string) {
  const words = Array.isArray(value)
    ? value.map((word) => compactText(word)).filter(Boolean)
    : [];

  if (words.length > 0) {
    return words;
  }

  return answer.split(/\s+/).filter(Boolean);
}

function normalizeQuestion(raw: unknown, index: number, section: string): PracticeQuestion | null {
  const rawQuestion = raw as Record<string, unknown>;
  const type = ['multiple_choice', 'fill_in_the_blank', 'matching', 'reorder_sentence', 'translation'].includes(String(rawQuestion?.type))
    ? (rawQuestion.type as PracticeType)
    : 'multiple_choice';

  const answer = compactText(rawQuestion?.answer);
  if (!answer) {
    return null;
  }

  const question: PracticeQuestion = {
    type,
    title: compactText(rawQuestion?.title) || `Practice ${index + 1}`,
    scenario: compactText(rawQuestion?.scenario) || `A beginner scenario for ${section}.`,
    question: compactText(rawQuestion?.question) || `Practice ${index + 1}`,
    audioText: compactText(rawQuestion?.audioText) || answer,
    answer,
    explanation: compactText(rawQuestion?.explanation) || 'This answer is correct for the lesson context.',
  };

  if (type === 'reorder_sentence') {
    question.words = normalizeWords(rawQuestion?.words, answer);
  } else if (type === 'translation') {
    const acceptedAnswers = Array.isArray(rawQuestion?.acceptedAnswers)
      ? rawQuestion.acceptedAnswers.map((item: unknown) => compactText(item)).filter(Boolean)
      : [];

    question.acceptedAnswers = Array.from(new Set([answer, ...acceptedAnswers]));
  } else {
    question.options = normalizeOptions(rawQuestion?.options, answer, section);
  }

  return question;
}

function normalizeQuestions(payload: unknown, section: string) {
  if (!Array.isArray(payload)) {
    throw new Error('AI response must be an array');
  }

  const questions = payload
    .map((item, index) => normalizeQuestion(item, index, section))
    .filter((item): item is PracticeQuestion => Boolean(item));

  if (questions.length !== 10) {
    throw new Error(`AI response must contain exactly 10 valid questions, received ${questions.length}`);
  }

  return questions;
}

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = (await request.json()) as PracticeRequest;
    const topic = compactText(body.topic) || 'beginner foundations';
    const lang = compactText(body.lang) || 'es';
    const section = compactText(body.section) || 'Getting Started';

    if (topic.length > 200) {
      return NextResponse.json({ success: false, error: 'Topic too long (max 200 characters)' }, { status: 400 });
    }
    if (lang && !/^[a-z]{2}$/.test(lang)) {
      return NextResponse.json({ success: false, error: 'Invalid language code' }, { status: 400 });
    }
    if (section.length > 100) {
      return NextResponse.json({ success: false, error: 'Section too long (max 100 characters)' }, { status: 400 });
    }

    const languageName = compactText(body.languageName) || LANGUAGE_NAMES[lang] || 'the selected language';
    
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ success: false, error: "GROQ_API_KEY is not configured in .env.local" }, { status: 500 });
    }

    const prompt = `You are an expert beginner language tutor.
Create exactly 10 practice exercises for a student learning ${languageName} (${lang}).
The lesson section is "${section}" and the topic focus is "${topic}".
The learner is starting from scratch, so keep every question beginner-friendly, practical, and short.

Return ONLY a raw JSON array. No markdown, no commentary, no trailing commas.

Use a mix of these exercise types:
- multiple_choice
- fill_in_the_blank
- matching
- reorder_sentence
- translation

Rules:
- Each object must include: type, title, scenario, question, audioText, answer, explanation.
- multiple_choice, fill_in_the_blank, and matching must also include options with exactly 4 strings.
- Randomize the position of the correct answer within the 4 options so it's not always first.
- reorder_sentence must also include words as a shuffled array of the words in the correct answer.
- translation must also include acceptedAnswers as an array of correct variants.
- Make the answer unambiguous and clearly teach the learner the target language.
- Keep the content grounded in real beginner situations like greetings, introductions, simple needs, food, travel, and daily life.

Example structure:
[
  {
    "type": "multiple_choice",
    "title": "Choose the greeting",
    "scenario": "You meet someone for the first time.",
    "question": "Which phrase should you say?",
    "audioText": "Hello",
    "options": ["Hello", "Goodbye", "Please", "Thanks"],
    "answer": "Hello",
    "explanation": "This is the correct greeting in the situation."
  },
  {
    "type": "fill_in_the_blank",
    "title": "Complete the sentence",
    "scenario": "You want to ask politely.",
    "question": "___, can you help me?",
    "audioText": "Please, can you help me?",
    "options": ["Please", "No", "Here", "Soon"],
    "answer": "Please",
    "explanation": "The polite word belongs in the blank."
  },
  {
    "type": "matching",
    "title": "Match the meaning",
    "scenario": "You are learning core vocabulary.",
    "question": "Choose the English meaning.",
    "audioText": "Good morning",
    "options": ["Good morning", "Book", "Water", "Table"],
    "answer": "Good morning",
    "explanation": "This is the correct match."
  },
  {
    "type": "reorder_sentence",
    "title": "Put the words in order",
    "scenario": "You want to introduce yourself.",
    "question": "Arrange the words to make a correct sentence.",
    "audioText": "I am a student.",
    "words": ["a", "student", "am", "I"],
    "answer": "I am a student",
    "explanation": "This is the natural word order."
  },
  {
    "type": "translation",
    "title": "Say it in ${languageName}",
    "scenario": "You need to ask for water politely.",
    "question": "Translate: 'I would like water, please.'",
    "audioText": "I would like water, please.",
    "acceptedAnswers": ["I would like water, please.", "I want water, please."],
    "answer": "I would like water, please.",
    "explanation": "This is the beginner-friendly translation for the situation."
  }
]
Generate exactly 10 varied exercises, and make sure the rest follow the same standards.`;

    const text = await fetchGroq(prompt, { retries: 3 });

    try {
      const data = JSON.parse(stripCodeFences(text));
      const normalized = normalizeQuestions(data, section);
      return NextResponse.json({ success: true, data: normalized });
    } catch {
      console.error("Failed to parse Groq response:", text);
      return NextResponse.json({ success: false, error: "Failed to parse AI response as JSON" }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error("Practice API Error:", error);
    const message = error instanceof Error ? error.message : 'Unknown practice API error';

    if (message.includes('status 429')) {
      console.warn('Groq rate limited — returning fallback questions');
      return NextResponse.json({ success: true, data: FALLBACK_QUESTIONS });
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
