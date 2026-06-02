import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

type ChatMessage = {
  sender: 'ai' | 'user';
  text: string;
};

type RoleplayScenario = {
  title: string;
  desc: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
  scenario?: RoleplayScenario;
  targetLanguage?: string;
  mode?: 'roleplay' | 'tutor';
};

function cleanJsonText(text: string) {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(cleanJsonText(text));
  } catch {
    return null;
  }
}

function buildConversationHistory(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.sender === 'ai' ? 'Tutor' : 'Learner'}: ${message.text}`)
    .join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const { messages, scenario, targetLanguage, mode } = (await req.json()) as ChatRequestBody;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is missing' }, { status: 500 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0 || !targetLanguage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const resolvedMode = mode === 'tutor' || !scenario ? 'tutor' : 'roleplay';
    const historyPrompt = buildConversationHistory(messages);

    let prompt = '';

    if (resolvedMode === 'roleplay' && scenario) {
      prompt = `You are a helpful AI language conversation partner for a user learning ${targetLanguage}.
The roleplay scenario is: ${scenario.title} - ${scenario.desc}.
Keep your response short (1-3 sentences) and natural.
Return ONLY a raw JSON object (no markdown) with this exact shape:
{
  "text": "response in ${targetLanguage}",
  "translation": "english translation"
}

Conversation:
${historyPrompt}`;
    } else {
      prompt = `You are an encouraging language tutor helping a learner practice ${targetLanguage}.
Reply mostly in ${targetLanguage}, but keep it understandable for beginners.
After your reply, include quick teaching guidance.
Return ONLY a raw JSON object (no markdown) with this exact shape:
{
  "text": "your tutor response in ${targetLanguage}",
  "translation": "english translation of your response",
  "feedback": "short feedback on the learner's last message",
  "tip": "one short actionable learning tip"
}

Conversation:
${historyPrompt}`;
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedResponse = safeParseJson(responseText);

    if (!parsedResponse) {
      return NextResponse.json({
        text: cleanJsonText(responseText),
        translation: '',
        feedback: '',
        tip: '',
      });
    }

    return NextResponse.json({
      text: parsedResponse.text || '',
      translation: parsedResponse.translation || '',
      feedback: parsedResponse.feedback || '',
      tip: parsedResponse.tip || '',
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
