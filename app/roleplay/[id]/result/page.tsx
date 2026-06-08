'use client';

import React, { use } from 'react';
import Link from 'next/link';
import styles from '../../Roleplay.module.css';

export default function RoleplayResult({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const lang = unwrappedParams.id;
  
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container} style={{maxWidth: '800px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        
        <div className={styles.resultBox}>
           <h1 style={{fontSize: '2rem', margin: 0}}>Scenario Complete!</h1>
           
           <div className={styles.resultScore}>85%</div>
           <p className={styles.resultLabel}>Great communication overall</p>

           <div className={styles.feedbackList}>
              <div className={`${styles.feedbackItem} ${styles.goodItem}`}>
                 <strong>Excellent Vocabulary</strong>
                 <p style={{margin: '0.5rem 0 0 0', color: '#555', fontSize: '0.95rem'}}>You successfully used domain-specific words without hesitation.</p>
              </div>
              <div className={`${styles.feedbackItem} ${styles.badItem}`}>
                 <strong>Grammar Tip</strong>
                 <p style={{margin: '0.5rem 0 0 0', color: '#555', fontSize: '0.95rem'}}>Remember to conjugate &quot;gustar&quot; correctly: <i>Me gustaría</i> instead of <i>Yo gusto</i>.</p>
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
