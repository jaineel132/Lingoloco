'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from './Recommendation.module.css';
import { useSupabaseAuth } from '../../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../../lib/supabase/clientFetch';

type RecommendationData = {
  headline: string;
  summary: string;
  sessionId: number;
  setId: number;
  sessionLabel: string;
  setLabel: string;
  estimatedMinutes: number;
  focusPoints: string[];
  whyThisWorks: string;
  nextActionLabel: string;
};

type RecommendationResponse = {
  success?: boolean;
  data?: RecommendationData;
  error?: string;
};

export default function RecommendationPage() {
  const router = useRouter();
  const params = useParams();
  const { accessToken } = useSupabaseAuth();
  const lang = typeof params?.lang === 'string' ? params.lang : 'es';

  const [recommendation, setRecommendation] = useState<RecommendationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRecommendation = async () => {
      try {
        if (!accessToken) {
          return;
        }

        const response = await fetch('/api/recommendation', withSupabaseAuthHeaders(accessToken, { cache: 'no-store' }));
        const json = (await response.json()) as RecommendationResponse;

        if (json.success && json.data) {
          setRecommendation(json.data);
        } else {
          setError(json.error || 'Unable to load recommendation');
        }
      } catch (requestError) {
        console.error(requestError);
        setError('Unable to load recommendation');
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendation();
  }, [accessToken]);

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.heroCard}>
        <div className={styles.badge}>AI Recommended Path</div>
        <h1 className={styles.title}>Your next lesson is chosen for you</h1>
        <p className={styles.subtitle}>
          This page uses your saved streak, XP, and roadmap progress to pick the most useful session and set right now.
        </p>

        {isLoading ? (
          <div className={styles.loadingBox}>Building your recommendation...</div>
        ) : error ? (
          <div className={styles.errorBox}>{error}</div>
        ) : recommendation ? (
          <div className={styles.contentGrid}>
            <div className={styles.primaryPanel}>
              <div className={styles.panelLabel}>AI Recommendation</div>
              <h2 className={styles.panelTitle}>{recommendation.headline}</h2>
              <p className={styles.panelSummary}>{recommendation.summary}</p>

              <div className={styles.statRow}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Session</span>
                  <strong>{recommendation.sessionLabel}</strong>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Set</span>
                  <strong>{recommendation.setLabel}</strong>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Time</span>
                  <strong>{recommendation.estimatedMinutes} min</strong>
                </div>
              </div>

              <div className={styles.focusBox}>
                <div className={styles.panelLabel}>Focus Points</div>
                <ul className={styles.focusList}>
                  {recommendation.focusPoints.length > 0 ? recommendation.focusPoints.map((point) => <li key={point}>{point}</li>) : <li>Follow the personalized AI lesson flow.</li>}
                </ul>
              </div>

              <div className={styles.reasonBox}>
                <strong>Why this works</strong>
                <p>{recommendation.whyThisWorks}</p>
              </div>
            </div>

            <div className={styles.sidePanel}>
              <div className={styles.nextCard}>
                <div className={styles.panelLabel}>Next Action</div>
                <h3>{recommendation.nextActionLabel}</h3>
                <p>Generated from your live dashboard progress and practice history.</p>
                <button
                  className={styles.primaryBtn}
                  onClick={() => router.push(`/learn/${lang}/practice?session=${recommendation.sessionId}&set=${recommendation.setId}`)}
                >
                  Start with AI
                </button>
              </div>

              <div className={styles.backCard}>
                <button className={styles.secondaryBtn} onClick={() => router.push(`/dashboard/${lang}`)}>
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
