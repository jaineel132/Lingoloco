'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../Roleplay.module.css';

type Message = { id: number; sender: 'ai' | 'user'; text: string; translation?: string };

import { SCENARIOS_DB } from '../../scenarios';
import { useSupabaseAuth } from '../../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../../lib/supabase/clientFetch';

const FULL_KEYBOARDS: Record<string, string[]> = {
  Spanish: [
    'q','w','e','r','t','y','u','i','o','p',
    'a','s','d','f','g','h','j','k','l','ñ',
    'z','x','c','v','b','n','m','á','é','í','ó','ú','¿','¡'
  ],
  French: [
    'a','z','e','r','t','y','u','i','o','p',
    'q','s','d','f','g','h','j','k','l','m',
    'w','x','c','v','b','n','é','è','ç','à','ù'
  ],
  German: [
    'q','w','e','r','t','z','u','i','o','p','ü',
    'a','s','d','f','g','h','j','k','l','ö','ä',
    'y','x','c','v','b','n','m','ß'
  ],
  Korean: [
    'ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ',
    'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ',
    'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'
  ],
  Japanese: [
    'あ','い','う','え','お','か','き','く','け','こ',
    'さ','し','す','せ','そ','た','ち','つ','て','と',
    'な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ',
    'ま','み','む','め','も','や','ゆ','よ','ら','り',
    'る','れ','ろ','わ','を','ん'
  ],
};

const DEFAULT_KEYS = [
  'q','w','e','r','t','y','u','i','o','p',
  'a','s','d','f','g','h','j','k','l',
  'z','x','c','v','b','n','m'
];

export default function RoleplaySession({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const { accessToken } = useSupabaseAuth();
  const scenario = SCENARIOS_DB[unwrappedParams.id] || SCENARIOS_DB['cafe'];
  
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'ai', text: '...', translation: 'Loading...' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    fetch('/api/user/profile', withSupabaseAuthHeaders(accessToken)).then(res => res.json()).then(data => {
      let langCode = 'es';
      if(data?.data?.courseId){
        langCode = data.data.courseId;
        const langMap: Record<string, string> = { es: 'Spanish', fr: 'French', ja: 'Japanese', de: 'German', it: 'Italian', kr: 'Korean', zh: 'Chinese', pt: 'Portuguese', ru: 'Russian', hi: 'Hindi' };
        setTargetLanguage(langMap[langCode] || 'Spanish');
      }
      setMessages([
        { id: 1, sender: 'ai', text: scenario.starter[langCode] || scenario.starter['es'], translation: 'Hello! Let\'s begin.' }
      ]);
    }).catch(() => {
      setMessages([
        { id: 1, sender: 'ai', text: scenario.starter['es'], translation: 'Hello! Let\'s begin.' }
      ]);
    });
  }, [accessToken, scenario]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const insertChar = (char: string) => {
    setInputValue(prev => prev + char);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const newMsg: Message = { id: Date.now(), sender: 'user', text: inputValue };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', withSupabaseAuthHeaders(accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          scenario: scenario,
          targetLanguage: targetLanguage
        })
      }));
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev,
          { id: Date.now()+1, sender: 'ai', text: data.text, translation: data.translation }
        ]);
      } else {
        console.error('Failed to get ai response');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={styles.pageWrapper} style={{paddingTop: '6rem'}}>
      <div className={styles.sessionLayout}>
      <div className={styles.container} style={{flex: 1, maxWidth: '800px', padding: 0}}>
        
        <div className={styles.chatHeader}>
          <div className={styles.chatAvatar}>{scenario.icon}</div>
          <div>
            <div className={styles.chatTitle}>{scenario.title}</div>
            <div className={styles.chatStatus}>AI Partner is active</div>
          </div>
          <button 
            onClick={() => router.push(`/roleplay/${unwrappedParams.id}/result`)}
            style={{marginLeft: 'auto', background: 'white', color: '#097C87', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '20px', fontWeight: 600, cursor: 'pointer'}}
          >
            Finish Roleplay
          </button>
        </div>

        <div className={styles.chatMessages} ref={scrollRef}>
          {messages.map(msg => (
             <div key={msg.id} className={`${styles.msgBubble} ${msg.sender === 'ai' ? styles.msgAi : styles.msgUser}`}>
               {msg.text}
               {msg.translation && <span className={styles.msgTranslation}>{msg.translation}</span>}
             </div>
          ))}
          {isTyping && (
             <div className={`${styles.msgBubble} ${styles.msgAi}`} style={{opacity: 0.6}}>
               Typing...
             </div>
          )}
        </div>

        <div className={styles.chatInputContainer}>
          <div className={styles.chatInputWrapper}>
             <input 
               className={styles.chatInput}
               placeholder={`Type your response in ${targetLanguage}...`}
               value={inputValue}
               onChange={e => setInputValue(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleSend()}
             />
             <button className={styles.sendBtn} onClick={handleSend} disabled={!inputValue.trim()}>
                ↑
             </button>
          </div>
        </div>

      </div>
      
      <div className={styles.externalKeyboardContainer}>
         <div className={styles.keyboardTitle}>
            {targetLanguage} Keyboard
         </div>
         <div className={styles.externalKeyboardGrid}>
            {(FULL_KEYBOARDS[targetLanguage] || DEFAULT_KEYS).map((char, i) => (
              <button 
                key={i} 
                className={styles.externalKeyboardKey}
                onClick={() => insertChar(char)}
              >
                {char}
              </button>
            ))}
         </div>
         <button 
            className={styles.spacebarKey}
            onClick={() => insertChar(' ')}
         >
           Space
         </button>
         <button 
            className={styles.backspaceKey}
            onClick={() => setInputValue(prev => prev.slice(0, -1))}
         >
           ⌫ Backspace
         </button>
      </div>
      
      </div>
    </div>
  );
}
