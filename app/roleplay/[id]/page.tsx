'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../Roleplay.module.css';
import { useSupabaseAuth } from '../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../lib/supabase/clientFetch';

import { SCENARIOS_DB } from '../scenarios';

export default function RoleplayDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const { accessToken } = useSupabaseAuth();
  const [langCode, setLangCode] = useState<string>('es');
  
  useEffect(() => {
    if (!accessToken) {
      return;
    }

    fetch('/api/user/profile', withSupabaseAuthHeaders(accessToken)).then(r => r.json()).then(data => {
      if(data?.data?.courseId) setLangCode(data.data.courseId);
    }).catch(()=>{});
  }, [accessToken]);

  const scenario = SCENARIOS_DB[unwrappedParams.id] || SCENARIOS_DB['cafe'];

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        
        <Link href="/roleplay" style={{textDecoration: 'none', color: '#888', marginBottom: '2rem', display: 'block'}}>
          ← Back to Scenarios
        </Link>
        
        <div className={styles.detailLayout}>
          
          <div>
            <div className={styles.scenarioIcon} style={{background: 'white', border: '1px solid #eee'}}>{scenario.icon}</div>
            <h1 className={styles.title} style={{fontSize: '2.5rem', marginBottom:'1rem'}}>{scenario.title}</h1>
            <p className={styles.subtitle} style={{fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '3rem'}}>{scenario.desc}</p>
            
            <button 
              className={styles.startBtn} 
              style={{padding: '1.2rem', fontSize: '1.2rem', background: '#1a1a1a', borderRadius: '30px'}}
              onClick={() => router.push(`/roleplay/${unwrappedParams.id}/session`)}
            >
              Start Chat Session 🎙️
            </button>
          </div>

          <div className={styles.vocabBox}>
            <h3 style={{fontSize: '1.4rem', fontWeight: 600, margin: 0}}>Key Vocabulary</h3>
            <p style={{color: '#666', marginTop: '0.4rem', fontSize: '0.9rem'}}>Helpful phrases you should try to use naturally.</p>
            
            <ul className={styles.vocabList}>
              {(scenario.vocab[langCode] || scenario.vocab['es']).map((v: any, i: number) => (
                 <li key={i} className={styles.vocabItem}>
                   <span className={styles.vocabForeign}>{v.f}</span>
                   <span className={styles.vocabNative}>{v.n}</span>
                 </li>
              ))}
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
}
