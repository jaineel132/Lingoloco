'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../lib/supabase/clientFetch';
import styles from './Learn.module.css';

const LANGUAGES = [
  { id: 'es', name: 'Spanish', flag: 'https://flagcdn.com/es.svg', color: '#EF476F', learners: '35M+' },
  { id: 'fr', name: 'French', flag: 'https://flagcdn.com/fr.svg', color: '#118AB2', learners: '28M+' },
  { id: 'ja', name: 'Japanese', flag: 'https://flagcdn.com/jp.svg', color: '#F78C6B', learners: '20M+' },
  { id: 'de', name: 'German', flag: 'https://flagcdn.com/de.svg', color: '#FFD166', learners: '18M+' },
  { id: 'it', name: 'Italian', flag: 'https://flagcdn.com/it.svg', color: '#06D6A0', learners: '15M+' },
  { id: 'kr', name: 'Korean', flag: 'https://flagcdn.com/kr.svg', color: '#8338EC', learners: '12M+' },
  { id: 'zh', name: 'Chinese', flag: 'https://flagcdn.com/cn.svg', color: '#E63946', learners: '25M+' },
  { id: 'pt', name: 'Portuguese', flag: 'https://flagcdn.com/br.svg', color: '#70A9A1', learners: '10M+' },
  { id: 'ru', name: 'Russian', flag: 'https://flagcdn.com/ru.svg', color: '#8ECAE6', learners: '8M+' },
  { id: 'hi', name: 'Hindi', flag: 'https://flagcdn.com/in.svg', color: '#FF9F1C', learners: '5M+' },
];

export default function Learn() {
  const router = useRouter();
  const { user, loading, accessToken } = useSupabaseAuth();

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
          const targetLanguage = payload.data?.targetLanguage || 'es';
          router.replace(`/learn/${targetLanguage}`);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, [accessToken, user, router]);

  if (loading || user) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#097C87' }}>
        Loading languages...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>What do you want to learn?</h1>
        <p className={styles.subtitle}>
          Choose from our 10 beautifully structured courses. Start speaking like a local from day one.
        </p>
      </div>

      <div className={styles.grid}>
        {LANGUAGES.map((lang) => (
          <Link 
            href={`/learn/${lang.id}`} 
            key={lang.id} 
            className={styles.card}
            style={{ '--card-color': lang.color } as React.CSSProperties}
          >
            <div className={styles.flagWrapper}>
              <div className={styles.flagBg} />
              <img src={lang.flag} alt={`${lang.name} language`} className={styles.flagImage} />
            </div>
            <h2 className={styles.languageName}>{lang.name}</h2>
            <div className={styles.learners}>{lang.learners} learners</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
