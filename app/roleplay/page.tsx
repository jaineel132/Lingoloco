'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './Roleplay.module.css';
import { useSupabaseAuth } from '../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../lib/supabase/clientFetch';

const LANGUAGES: Record<string, {name: string, flag: string}> = {
  es: { name: 'Spanish', flag: '🇪🇸' },
  fr: { name: 'French', flag: '🇫🇷' },
  ja: { name: 'Japanese', flag: '🇯🇵' },
  de: { name: 'German', flag: '🇩🇪' },
  it: { name: 'Italian', flag: '🇮🇹' },
  kr: { name: 'Korean', flag: '🇰🇷' },
  zh: { name: 'Chinese', flag: '🇨🇳' },
  pt: { name: 'Portuguese', flag: '🇵🇹' },
  ru: { name: 'Russian', flag: '🇷🇺' },
  hi: { name: 'Hindi', flag: '🇮🇳' },
};

const SCENARIOS = [
  { id: 'cafe', icon: '☕', title: 'Ordering at a Cafe', desc: 'Practice requesting coffee and pastries in a busy environment.' },
  { id: 'airport', icon: '✈️', title: 'Airport Check-in', desc: 'Navigate security questions and flight boarding procedures.' },
  { id: 'directions', icon: '🗺️', title: 'Asking for Directions', desc: 'Find your way to the famous museum using local transit phrasing.' },
  { id: 'shopping', icon: '🛍️', title: 'Market Haggling', desc: 'Negotiate prices for souvenirs at an outdoor market.' },
];

export default function RoleplayList() {
  const { accessToken } = useSupabaseAuth();
  const [langCode, setLangCode] = useState<string>('es'); // default fallback
  const [loading, setLoading] = useState(true);

  // Fetch the user's selected language on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        if (!accessToken) {
          return;
        }

        const res = await fetch('/api/user/profile', withSupabaseAuthHeaders(accessToken));
        if (res.ok) {
          const data = await res.json();
          if (data?.data?.courseId) {
            setLangCode(data.data.courseId);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [accessToken]);

  const langInfo = LANGUAGES[langCode] || { name: langCode.toUpperCase(), flag: '🌍' };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Practice Scenarios</h1>
            <p className={styles.subtitle}>Select a roleplay environment to test your conversational skills.</p>
          </div>
          <div className={styles.langPill}>
             {langInfo.flag} Learning {langInfo.name}
          </div>
        </div>

        <div className={styles.scenarioGrid}>
          {SCENARIOS.map(s => (
            <Link key={s.id} href={`/roleplay/${s.id}`} className={styles.scenarioCard}>
               <div className={styles.scenarioIcon}>{s.icon}</div>
               <div className={styles.scenarioTitle}>{s.title}</div>
               <div className={styles.scenarioDesc}>{s.desc}</div>
               <button className={styles.startBtn}>View Setup ▶</button>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
