'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from '../../Roleplay.module.css';

type StoredSession = {
  messages: { id: number; sender: 'ai' | 'user'; text: string; translation?: string }[];
  targetLanguage: string;
  scenarioId: string;
};

export default function RoleplayResult() {
  const params = useParams();
  const lang = (params?.id as string) || 'es';

  const [session] = useState<StoredSession | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(`roleplay_${lang}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredSession; } catch { return null; }
  });

  useEffect(() => {
    const raw = sessionStorage.getItem(`roleplay_${lang}`);
    if (!raw) return;

    const parsed = (() => { try { return JSON.parse(raw) as StoredSession; } catch { return null; } })();
    if (!parsed) return;

    const startTime = sessionStorage.getItem(`roleplay_${lang}_start`);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const startSeconds = startTime ? parseInt(startTime, 10) : nowSeconds - 120;
    const durationSeconds = Math.max(30, nowSeconds - startSeconds);
    const userMsgCount = parsed.messages.filter(m => m.sender === 'user').length;
    const totalExchanges = parsed.messages.length;
    const score = Math.min(100, Math.round((userMsgCount / Math.max(totalExchanges - 1, 1)) * 100));
    const xpEarned = Math.round(score * 0.5 + userMsgCount * 2);

    fetch('/api/roleplay/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioId: parsed.scenarioId || lang,
        targetLanguage: parsed.targetLanguage || lang,
        messageCount: totalExchanges,
        userMessageCount: userMsgCount,
        score,
        xpEarned,
        durationSeconds,
      }),
    }).catch(() => {});

    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: 'roleplay',
        sessionMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        xpEarned,
        score,
        totalQuestions: Math.max(1, totalExchanges - 1),
      }),
    }).catch(() => {});
  }, [lang]);

  const userMessageCount = session?.messages.filter(m => m.sender === 'user').length || 0;
  const totalExchanges = session?.messages.length || 1;
  const score = session ? Math.min(100, Math.round((userMessageCount / Math.max(totalExchanges - 1, 1)) * 100)) : 85;
  const languageName = session?.targetLanguage || 'the language';

  const label = score >= 80 ? 'Great communication overall!' : score >= 60 ? 'Good effort, keep practicing!' : 'Nice try, review and try again!';

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container} style={{maxWidth: '800px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        
        <div className={styles.resultBox}>
           <h1 style={{fontSize: '2rem', margin: 0}}>Scenario Complete!</h1>
           
           <div className={styles.resultScore}>{score}%</div>
           <p className={styles.resultLabel}>{label}</p>

           <div className={styles.feedbackList}>
              <div className={`${styles.feedbackItem} ${styles.goodItem}`}>
                 <strong>Conversation Practice</strong>
                 <p style={{margin: '0.5rem 0 0 0', color: '#555', fontSize: '0.95rem'}}>
                   You exchanged {userMessageCount} messages in {languageName}. Keep practicing to build fluency.
                 </p>
              </div>
              <div className={`${styles.feedbackItem} ${styles.badItem}`}>
                 <strong>Keep Going</strong>
                 <p style={{margin: '0.5rem 0 0 0', color: '#555', fontSize: '0.95rem'}}>
                   Try to have longer conversations next time. Each exchange helps reinforce vocabulary and grammar.
                 </p>
              </div>
           </div>

           <Link href={`/dashboard/${lang}`} className={styles.finishBtn}>
             Return to Dashboard
           </Link>
        </div>

      </div>
    </div>
  );
}
