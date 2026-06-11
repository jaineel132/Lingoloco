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
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`roleplay_${lang}`);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as StoredSession);
      } catch { /* ignore */ }
    }
  }, [lang]); // eslint-disable-line react-hooks/set-state-in-effect

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
