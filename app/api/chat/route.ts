import { NextRequest, NextResponse } from 'next/server';
import { fetchGroq } from '../../../lib/groq';

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

    if (!messages || !Array.isArray(messages) || messages.length === 0 || !targetLanguage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Groq API key is not configured.' }, { status: 500 });
    }

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

    const responseText = await fetchGroq(prompt);
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
