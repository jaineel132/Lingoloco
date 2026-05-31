'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseAuth } from '../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../lib/supabase/clientFetch';
import { getSupabaseBrowserClient } from '../../../lib/supabase/browser';
import styles from './Dashboard.module.css';

const LANGUAGES: Record<string, {name: string, color: string, flag: string}> = {
  es: { name: 'Spanish', color: '#EF476F', flag: 'https://flagcdn.com/es.svg' },
  fr: { name: 'French', color: '#118AB2', flag: 'https://flagcdn.com/fr.svg' },
  ja: { name: 'Japanese', color: '#F78C6B', flag: 'https://flagcdn.com/jp.svg' },
  de: { name: 'German', color: '#FFD166', flag: 'https://flagcdn.com/de.svg' },
  it: { name: 'Italian', color: '#06D6A0', flag: 'https://flagcdn.com/it.svg' },
  kr: { name: 'Korean', color: '#8338EC', flag: 'https://flagcdn.com/kr.svg' },
  zh: { name: 'Chinese', color: '#E63946', flag: 'https://flagcdn.com/cn.svg' },
  pt: { name: 'Portuguese', color: '#70A9A1', flag: 'https://flagcdn.com/br.svg' },
  ru: { name: 'Russian', color: '#8ECAE6', flag: 'https://flagcdn.com/ru.svg' },
  hi: { name: 'Hindi', color: '#FF9F1C', flag: 'https://flagcdn.com/in.svg' },
};

const AVATAR_BUCKET = 'profileimages';

type DashboardUserData = {
  name?: string;
  image?: string;
  level?: string;
  targetLanguage?: string;
  xp?: number;
  streak?: number;
  dailyProgressMinutes?: number;
  dailyGoalMinutes?: number;
  lessonsCompleted?: number;
  totalTimeHours?: number;
  progressSummary?: {
    xp: number;
    streak: number;
    dailyGoalMinutes: number;
    dailyProgressMinutes: number;
    dailyProgressPercent: number;
    dailyGoalReached: boolean;
    lessonsCompleted: number;
    totalTimeHours: number;
    progressMessage: string;
    practiceRoadmap?: {
      totalSessions: number;
      setsPerSession: number;
      totalSets: number;
      completedSessions: number;
      completedSets: number;
      roadmapProgressPercent: number;
      currentSessionId: number;
      currentSetId: number;
      currentSessionLabel: string;
      currentSetLabel: string;
      nextActionLabel: string;
    };
  };
};

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, accessToken } = useSupabaseAuth();
  const params = useParams();
  const langIdStr = typeof params?.lang === 'string' ? params.lang : 'es';
  
  const [userData, setUserData] = useState<DashboardUserData | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const selectedLanguage = userData?.targetLanguage || langIdStr;
  const langInfo = LANGUAGES[selectedLanguage] || { name: 'Language', color: '#097C87', flag: 'https://flagcdn.com/un.svg' };

  const fetchDashboardData = async (signal?: AbortSignal) => {
    if (!accessToken) {
      return;
    }

    try {
      const response = await fetch('/api/dashboard', withSupabaseAuthHeaders(accessToken, {
        cache: 'no-store',
        signal,
      }));

      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || `Dashboard request failed (${response.status})`);
      }

      const data = await response.json();

      if (data.success) {
        setUserData(data.data);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }

      console.error('Failed to load dashboard data:', error);
    }
  };

  const openPhotoPicker = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadMessage('Please choose an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadMessage('Please choose an image smaller than 2 MB.');
      return;
    }

    if (!accessToken) {
      setUploadMessage('Please sign in again and try uploading the photo.');
      return;
    }

    setIsUploadingPhoto(true);
    setUploadMessage('Uploading photo...');

    try {
      const supabase = getSupabaseBrowserClient();
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${user?.id || 'user'}-${Date.now()}.${fileExtension}`;
      const filePath = `${user?.id || 'profile'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const response = await fetch('/api/user/profile', withSupabaseAuthHeaders(accessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: publicUrl }),
      }));

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Photo upload failed.');
      }

      setUserData(payload.data);
      setUploadMessage('Photo updated successfully.');
      await fetchDashboardData();
    } catch (error: any) {
      console.error(error);
      setUploadMessage(error?.message || 'Photo upload failed.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  useEffect(() => {
    if (user && accessToken) {
      const controller = new AbortController();

      void fetchDashboardData(controller.signal);

      return () => {
        controller.abort();
      };
    }
  }, [accessToken, user]);

  useEffect(() => {
    const handleRefresh = () => {
      if (!user || !accessToken || document.visibilityState !== 'visible') {
        return;
      }

      void fetchDashboardData();
    };

    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleRefresh);

    return () => {
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleRefresh);
    };
  }, [accessToken, user]);

  if (loading) {
    return <div className={styles.pageWrapper} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#097C87'}}>Loading your dashboard...</div>;
  }

  if (!user) {
    return (
      <div className={styles.pageWrapper} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
        <h1 style={{color: '#097C87', fontFamily: 'var(--font-fraunces)'}}>Welcome to LingoLoco</h1>
        <p style={{marginBottom: '2rem'}}>Please sign in to view your progress.</p>
        <button onClick={() => signInWithGoogle('/dashboard/es')} style={{background: '#097C87', color: 'white', padding: '1rem 2rem', borderRadius: '50px', border: 'none', cursor: 'pointer', fontWeight: 'bold'}} >
          Connect with Google
        </button>
      </div>
    );
  }

  const name = userData?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Learner';
  const avatarUrl = userData?.image || user?.user_metadata?.avatar_url || null;
  const level = userData?.level || 'Beginner';
  const progress = userData?.progressSummary;
  const xp = progress?.xp ?? userData?.xp ?? 0;
  const streak = progress?.streak ?? userData?.streak ?? 0;
  const dailyProg = progress?.dailyProgressMinutes ?? userData?.dailyProgressMinutes ?? 0;
  const dailyGoal = progress?.dailyGoalMinutes ?? userData?.dailyGoalMinutes ?? 10;
  const dailyProgressPercent = progress?.dailyProgressPercent ?? (dailyGoal > 0 ? Math.min(100, Math.round((dailyProg / dailyGoal) * 100)) : 0);
  const lessonsCompleted = progress?.lessonsCompleted ?? userData?.lessonsCompleted ?? 0;
  const totalTimeHours = progress?.totalTimeHours ?? userData?.totalTimeHours ?? 0;
  const dailyGoalReached = progress?.dailyGoalReached ?? dailyProg >= dailyGoal;
  const progressMessage = progress?.progressMessage ?? `${Math.max(0, dailyGoal - dailyProg)} min to daily goal`;
  const roadmap = progress?.practiceRoadmap;
  const roadmapPercent = roadmap?.roadmapProgressPercent ?? 0;
  const roadmapLabel = roadmap?.nextActionLabel ?? 'Session 1 • Set 1';
  const roadmapCounts = roadmap ? `${roadmap.completedSessions}/${roadmap.totalSessions} sessions • ${roadmap.completedSets}/${roadmap.totalSets} sets` : '0/10 sessions • 0/70 sets';
  const recommendedSessionId = roadmap?.currentSessionId ?? 1;
  const recommendedSetId = roadmap?.currentSetId ?? 1;

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.dashboardContainer}>

        {/* Main Grid holding all 8 requirements in a highly compact architecture */}
        <div className={styles.mainGrid}>
          
          {/* 1. Greeting + Language + Level + Image */}
          <div className={`${styles.whiteCard} ${styles.greetingCard}`} style={{ gridColumn: '1 / span 2', gridRow: '1' }}>
            <div className={styles.greetingLeft}>
              <h1 className={styles.greetingText}>
                Welcome, <br/>
                <div className={styles.savedNameDisplay}>
                  {name}
                </div>
              </h1>
              <div className={styles.tagsRow}>
                 <span className={styles.levelTagLight}>🌍 Learning {langInfo.name}</span>
                 <span className={styles.levelTagDark}>🎯 {level}</span>
              </div>
            </div>

            <div className={styles.photoBlock}>
              <button type="button" className={styles.smallImageUpload} title="Upload Profile Picture" onClick={openPhotoPicker}>
                {avatarUrl ? (
                   <img src={avatarUrl} className={styles.smallAvatar} alt="profile" referrerPolicy="no-referrer" />
                ) : (
                  <div className={styles.smallAvatarPlaceholder}>📷</div>
                )}
              </button>
              <div className={styles.photoHint}>{isUploadingPhoto ? 'Uploading photo...' : 'Click to upload'}</div>
              <input ref={photoInputRef} className={styles.hiddenFile} type="file" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>

          {/* 2. Streak 🔥 + XP ⭐ */}
          <div className={styles.whiteCard} style={{ gridColumn: '3', gridRow: '1' }}>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardTitle}>XP & Streak</div>
            </div>
            <div className={styles.hugeStat}>{xp} <span style={{fontSize: '1rem', color: '#777'}}>XP ⭐</span></div>
            <span className={styles.subStat}>🔥 {streak} Day Streak</span>
            
            <div className={styles.chartBars}>
              <div className={styles.barLight} style={{height: '30%'}}/>
              <div className={styles.bar} style={{height: '60%'}}/>
              <div className={styles.bar} style={{height: '50%'}}/>
              <div className={styles.bar} style={{height: '75%'}}/>
              <div className={styles.barGreen} style={{height: '40%'}}/>
              <div className={styles.barLight} style={{height: '20%'}}/>
            </div>
          </div>

          {/* 3. Daily Goal Progress 🎯 */}
          <div className={styles.whiteCard} style={{ gridColumn: '3', gridRow: '2', alignItems: 'center' }}>
             <div className={styles.cardTitleRow} style={{width: '100%'}}>
              <div className={styles.cardTitle}>Daily Goal 🎯</div>
            </div>
            <div className={styles.circleCardWrapper}>
              <div
                className={styles.timeCircle}
                style={{ background: `conic-gradient(#097C87 0deg ${dailyProgressPercent * 3.6}deg, #f5f5f5 ${dailyProgressPercent * 3.6}deg 360deg)` }}
              >
                <div className={styles.timeCircleContent}>
                  <span className={styles.circleVal}>{dailyProg}/{dailyGoal}</span>
                  <span className={styles.circleLbl}>Minutes</span>
                </div>
              </div>
            </div>
            <div style={{ width: '100%', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666', marginBottom: '0.45rem' }}>
                <span>{dailyGoalReached ? 'Goal complete' : 'Keep going'}</span>
                <span>{dailyProgressPercent}%</span>
              </div>
              <div style={{ height: '10px', borderRadius: '999px', background: '#f2f2f2', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${dailyProgressPercent}%`, background: dailyGoalReached ? '#06D6A0' : '#097C87', borderRadius: '999px', transition: 'width 0.3s ease' }} />
              </div>
              <div className={styles.circleLbl} style={{ marginTop: '0.75rem', textAlign: 'center' }}>{progressMessage}</div>
            </div>
          </div>

          {/* 4 & 5. Action Buttons */}
          <div className={styles.actionBtnGrid} style={{ gridColumn: '4', gridRow: '1 / span 2' }}>
            
            {/* Primary Action Button */}
            <button className={styles.primaryActionBtn} onClick={() => router.push(`/learn/${selectedLanguage}`)}>
               <div className={styles.primaryActionIcon}>▶️</div>
               <div className={styles.primaryActionTextCol}>
                 <span className={styles.primaryActionTitle}>Continue Learning</span>
                 <span className={styles.primaryActionSub}>Start your AI practice session</span>
               </div>
            </button>

            {/* Quick Actions Array */}
            <div className={styles.quickActionPairs}>
              <button className={styles.quickActionPill} onClick={() => router.push('/chat')}>
                <span>💬</span> Practice Chat
              </button>
              <Link href="/roleplay" style={{textDecoration: 'none'}}>
                <button className={styles.quickActionPill}>
                  <span>🎭</span> Roleplay
                </button>
              </Link>
              <Link href="/flashcards" style={{textDecoration: 'none'}} className={styles.quickActionPill}>
                <span>🎯</span> Flashcards
              </Link>
            </div>

          </div>

          {/* 6. Recommended Section 🧠 */}
          <div className={`${styles.whiteCard}`} style={{ gridColumn: '1 / span 2', gridRow: '2', padding: '1.5rem 2rem' }}>
            <div className={styles.scheduleHeader}>
               <strong>Recommended For You 🧠</strong>
               <span>Based on your recent progress</span>
            </div>
            
            <div className={styles.schedulePill}>
               <div className={styles.iconCircle}>✨</div>
               <div>
                <div className={styles.pillTitle}>{roadmapLabel}</div>
                <div className={styles.pillSub}>{roadmapCounts} • {roadmapPercent}% completed</div>
               </div>
              <button
                className={styles.startPillBtn}
                onClick={() => router.push(`/learn/${selectedLanguage}/recommendation`)}
              >
                Start
              </button>
            </div>
          </div>

          {/* 7. Progress Summary 📊 + 8. Competition Preview 🏆 */}
          <div className={styles.whiteCard} style={{ gridColumn: '1 / span 4', gridRow: '3', display: 'flex', flexDirection: 'row', gap: '3rem' }}>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className={styles.cardTitle}>Progress Summary 📊</div>
              <div className={styles.circleLbl} style={{ marginTop: '0.35rem' }}>Streak, XP, lessons, and time are saved from the backend.</div>
              <div className={styles.statStackRowInner}>
                <div className={styles.statStackItem}>
                  <span className={styles.statStackValDark}>{lessonsCompleted}</span>
                  <span className={styles.circleLbl}>Lessons</span>
                </div>
                <div className={styles.statStackItem}>
                  <span className={styles.statStackValDark}>{totalTimeHours}h</span>
                  <span className={styles.circleLbl}>Total Time</span>
                </div>
                <div className={styles.statStackItem}>
                  <span className={styles.statStackValDark}>{streak}</span>
                  <span className={styles.circleLbl}>Day Streak</span>
                </div>
              </div>
              <div style={{ marginTop: '1rem', padding: '1rem 1.1rem', borderRadius: '20px', background: '#f8fcfc', border: '1px solid rgba(9, 124, 135, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <div className={styles.cardTitle} style={{ fontSize: '0.98rem' }}>Practice Roadmap</div>
                    <div className={styles.circleLbl} style={{ marginTop: '0.2rem' }}>{roadmapLabel}</div>
                  </div>
                  <strong style={{ color: '#097C87' }}>{roadmapPercent}%</strong>
                </div>
                <div style={{ height: '10px', borderRadius: '999px', background: '#e9f4f4', overflow: 'hidden', marginTop: '0.8rem' }}>
                  <div style={{ height: '100%', width: `${roadmapPercent}%`, background: '#097C87', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                </div>
                <div className={styles.circleLbl} style={{ marginTop: '0.65rem' }}>{roadmapCounts}</div>
              </div>
            </div>
            
            <div style={{ width: '1px', background: '#eaeaea' }} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
               <div className={styles.cardTitle}>Competition 🏆</div>
               <div style={{ marginTop: '0.5rem' }}>
                  <div className={styles.rankText}>Unranked</div>
                  <span className={styles.circleLbl} style={{display: 'block', marginBottom: '0.8rem'}}>Global Rank</span>
                  <Link href="/compete" style={{textDecoration: 'none'}}>
                    <button className={styles.joinBtnGreen}>View Leaderboard</button>
                  </Link>
               </div>
            </div>

          </div>

        </div>

        {uploadMessage ? <div className={styles.uploadToast}>{uploadMessage}</div> : null}

      </div>
    </div>
  )
}
