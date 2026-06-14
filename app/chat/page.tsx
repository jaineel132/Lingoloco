'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Send, Bot, User, Languages } from 'lucide-react';
import { useSupabaseAuth } from '../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../lib/supabase/clientFetch';
import styles from './page.module.css';

type ChatMessage = {
  id: number;
  sender: 'ai' | 'user';
  text: string;
  translation?: string;
  feedback?: string;
  tip?: string;
};

type DashboardData = {
  targetLanguage?: string;
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

const INITIAL_GREETINGS: Record<string, { text: string; translation: string }> = {
  es: {
    text: 'Hola! Soy tu tutor de espanol. Cuentame sobre tu dia y te ayudare a mejorar.',
    translation: "Hello! I am your Spanish tutor. Tell me about your day and I will help you improve.",
  },
  fr: {
    text: "Bonjour! Je suis votre professeur de francais. Parlez-moi de votre journee et je vous aiderai a vous ameliorer.",
    translation: "Hello! I am your French tutor. Tell me about your day and I will help you improve.",
  },
  ja: {
    text: 'Konnichiwa! Watashi wa anata no Nihongo no sensei desu. Kyou no dekigoto o oshiete kudasai. Issho ni jouzu ni narimashou.',
    translation: "Hello! I am your Japanese tutor. Tell me about your day and I will help you improve.",
  },
  de: {
    text: 'Hallo! Ich bin dein Deutschlehrer. Erzaehle mir von deinem Tag und ich helfe dir, besser zu werden.',
    translation: "Hello! I am your German tutor. Tell me about your day and I will help you improve.",
  },
  it: {
    text: 'Ciao! Sono il tuo tutor di italiano. Raccontami della tua giornata e ti aiutero a migliorare.',
    translation: "Hello! I am your Italian tutor. Tell me about your day and I will help you improve.",
  },
  kr: {
    text: 'Annyeonghaseyo! Jeon dangsin-ui Hangugeo seonsaengnim-imnida. Oneur-ui ilsang-eul malssem-hae juseyo. Jeoneun dangsin-i deo jal hage dopge hasipsida.',
    translation: "Hello! I am your Korean tutor. Tell me about your day and I will help you improve.",
  },
  zh: {
    text: 'Nihao! Wo shi ni de hanyu jiaolian. Gaosu wo ni jintian de shenghuo, wo hui bangzhu ni tigao.',
    translation: "Hello! I am your Chinese tutor. Tell me about your day and I will help you improve.",
  },
  pt: {
    text: 'Ola! Sou seu tutor de portugues. Conte-me sobre o seu dia e vou ajuda-lo a melhorar.',
    translation: "Hello! I am your Portuguese tutor. Tell me about your day and I will help you improve.",
  },
  ru: {
    text: 'Zdravstvuyte! Ya vash prepodavatel russkogo yazyka. Rasskazhite mne o svoyom dne, i ya pomogu vam uluchshit svoi navyki.',
    translation: "Hello! I am your Russian tutor. Tell me about your day and I will help you improve.",
  },
  hi: {
    text: 'Namaste! Main aapki Hindi adhyapak hoon. Apne din ke baare mein bataayein aur main aapko behtar banane mein madad karoongi.',
    translation: "Hello! I am your Hindi tutor. Tell me about your day and I will help you improve.",
  },
};

export default function ChatPage() {
  const { user, loading, signInWithGoogle, accessToken } = useSupabaseAuth();
  const [targetLanguageCode, setTargetLanguageCode] = useState('es');
  const [targetLanguageName, setTargetLanguageName] = useState('Spanish');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!accessToken) {
      return;
    }

    fetch('/api/dashboard', withSupabaseAuthHeaders(accessToken, { cache: 'no-store' }))
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.success) {
          const data = payload.data as DashboardData;
          const langCode = data.targetLanguage || 'es';
          setTargetLanguageCode(langCode);
          setTargetLanguageName(LANGUAGE_NAMES[langCode] || 'Spanish');
          const greeting = INITIAL_GREETINGS[langCode] || INITIAL_GREETINGS['es'];
          setMessages([
            {
              id: Date.now(),
              sender: 'ai',
              text: greeting.text,
              translation: greeting.translation,
              feedback: 'Try writing your first sentence now.',
              tip: 'Keep your first message short and simple.',
            },
          ]);
        }
      })
      .catch((requestError) => {
        console.error(requestError);
      });
  }, [accessToken, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    setError('');
    const userMessage: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text: trimmed,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', withSupabaseAuthHeaders(accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'tutor',
          targetLanguage: targetLanguageName,
          messages: updatedMessages.map((message) => ({ sender: message.sender, text: message.text })),
        }),
      }));

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not send message');
      }

      const aiMessage: ChatMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: payload.text || '',
        translation: payload.translation || '',
        feedback: payload.feedback || '',
        tip: payload.tip || '',
      };

      setMessages((current) => [...current, aiMessage]);
    } catch (requestError: any) {
      console.error(requestError);
      setError(requestError?.message || 'Something went wrong.');
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return <div className={styles.centeredState}>Loading chat...</div>;
  }

  if (!user) {
    return (
      <div className={styles.centeredState}>
        <h1>Please sign in to use Tutor Chat.</h1>
        <button className={styles.signInBtn} onClick={() => signInWithGoogle('/chat')}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.header}>
        <div>
          <h1>Tutor Chat</h1>
          <p>Practice {targetLanguageName} with real-time AI feedback.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.langBadge}><Languages size={15} /> {targetLanguageCode.toUpperCase()}</span>
          <Link href={`/dashboard/${targetLanguageCode}`} className={styles.backLink}>Back to Dashboard</Link>
        </div>
      </div>

      <div className={styles.chatPanel}>
        <div className={styles.messages} ref={scrollRef}>
          {messages.map((message) => (
            <div key={message.id} className={`${styles.messageRow} ${message.sender === 'ai' ? styles.ai : styles.user}`}>
              <div className={styles.avatar}>{message.sender === 'ai' ? <Bot size={16} /> : <User size={16} />}</div>
              <div className={styles.bubble}>
                <p className={styles.messageText}>{message.text}</p>
                {message.translation ? <p className={styles.translation}>EN: {message.translation}</p> : null}
                {message.feedback ? <p className={styles.feedback}>Feedback: {message.feedback}</p> : null}
                {message.tip ? <p className={styles.tip}>Tip: {message.tip}</p> : null}
              </div>
            </div>
          ))}
          {isSending ? <div className={styles.typing}>Tutor is typing...</div> : null}
        </div>

        <div className={styles.inputBar}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                sendMessage();
              }
            }}
            placeholder={`Write in ${targetLanguageName}...`}
          />
          <button onClick={sendMessage} disabled={!input.trim() || isSending}>
            <Send size={16} />
            Send
          </button>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>
    </div>
  );
}
