'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from './Onboarding.module.css';
import Link from 'next/link';
import { useSupabaseAuth } from '../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../lib/supabase/clientFetch';

// Constant language configurations
const LANGUAGES: Record<string, {name: string, color: string}> = {
  es: { name: 'Spanish', color: '#EF476F' },
  fr: { name: 'French', color: '#118AB2' },
  ja: { name: 'Japanese', color: '#F78C6B' },
  de: { name: 'German', color: '#FFD166' },
  it: { name: 'Italian', color: '#06D6A0' },
  kr: { name: 'Korean', color: '#8338EC' },
  zh: { name: 'Chinese', color: '#E63946' },
  pt: { name: 'Portuguese', color: '#70A9A1' },
  ru: { name: 'Russian', color: '#8ECAE6' },
  hi: { name: 'Hindi', color: '#FF9F1C' },
};

export default function LanguageOnboarding() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, loading } = useSupabaseAuth();
  
  // Guard the language parameter
  const langIdStr = typeof params?.lang === 'string' ? params.lang : 'es';
  const langInfo = LANGUAGES[langIdStr] || { name: 'this language', color: '#097C87' };
  
  // State for the wizard form structure
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    courseId: langIdStr,
    level: '',
    commitment: 0,
    remindersEnabled: true,
    reminderTime: '18:00'
  });
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (loading) {
        return;
      }

      if (!accessToken) {
        setIsCheckingProfile(false);
        return;
      }

      try {
        const response = await fetch('/api/dashboard', withSupabaseAuthHeaders(accessToken, { cache: 'no-store' }));
        const json = await response.json();

        if (json?.success && json?.data) {
          setProfileData(json.data);
        }
      } catch (error) {
        console.error('Failed to load roadmap profile:', error);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    void loadProfile();
  }, [accessToken, loading]);

  const LEVELS = [
    { id: 'new', icon: '🐣', label: "I'm completely new" },
    { id: 'basics', icon: '🌱', label: "I know a few basics" },
    { id: 'conversations', icon: '🌿', label: "I can hold basic conversations" },
    { id: 'comfortable', icon: '🌳', label: "I'm fairly comfortable" },
  ];

  const TIMES = [5, 10, 15, 30, 60];

  const roadmap = profileData?.progressSummary?.practiceRoadmap;
  const targetLanguageName = profileData?.targetLanguage
    ? (LANGUAGES[profileData.targetLanguage]?.name || langInfo.name)
    : langInfo.name;
  const themeColor = profileData?.targetLanguage
    ? (LANGUAGES[profileData.targetLanguage]?.color || langInfo.color)
    : langInfo.color;

  if (loading || isCheckingProfile) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#097C87' }}>
        Loading your roadmap...
      </div>
    );
  }

  if (profileData) {
    return (
      <div className={styles.container} style={{ paddingTop: '8rem', ['--theme-color' as any]: themeColor }}>
        <div className={styles.roadmapShell}>
          <div className={styles.roadmapHero}>
            <div className={styles.roadmapEyebrow}>Roadmap</div>
            <h1 className={styles.roadmapTitle}>Your {targetLanguageName} path</h1>
            <p className={styles.roadmapSubtitle}>
              Pick up where you left off, or jump straight into the next recommended session.
            </p>

            <div className={styles.roadmapActions}>
              <button
                className={styles.roadmapPrimaryBtn}
                onClick={() => router.push(`/learn/${langIdStr}/practice?session=${roadmap?.currentSessionId ?? 1}&set=${roadmap?.currentSetId ?? 1}`)}
              >
                Start Current Session
              </button>
              <Link href={`/learn/${langIdStr}/recommendation`} className={styles.roadmapSecondaryBtn}>
                View Recommendation
              </Link>
            </div>
          </div>

          <div className={styles.roadmapGrid}>
            <div className={styles.roadmapCard}>
              <div className={styles.roadmapCardLabel}>Current Progress</div>
              <div className={styles.roadmapMetric}>{profileData.progressSummary?.xp ?? 0} XP</div>
              <div className={styles.roadmapSubtle}>{profileData.progressSummary?.streak ?? 0} day streak</div>
              <div className={styles.roadmapBarTrack}>
                <div className={styles.roadmapBarFill} style={{ width: `${profileData.progressSummary?.dailyProgressPercent ?? 0}%`, background: themeColor }} />
              </div>
              <div className={styles.roadmapFooter}>
                {profileData.progressSummary?.dailyProgressMinutes ?? 0}/{profileData.progressSummary?.dailyGoalMinutes ?? 10} minutes today
              </div>
            </div>

            <div className={styles.roadmapCard}>
              <div className={styles.roadmapCardLabel}>Next Stop</div>
              <div className={styles.roadmapNextTitle}>{roadmap?.currentSessionLabel || 'Session 1'} • {roadmap?.currentSetLabel || 'Set 1'}</div>
              <div className={styles.roadmapSubtle}>{roadmap?.nextActionLabel || 'Continue with the next practice set.'}</div>
              <div className={styles.roadmapCompletion}>{roadmap?.roadmapProgressPercent ?? 0}% complete</div>
            </div>

            <div className={styles.roadmapCard}>
              <div className={styles.roadmapCardLabel}>Quick Actions</div>
              <div className={styles.roadmapQuickList}>
                <button className={styles.roadmapQuickBtn} onClick={() => router.push(`/dashboard/${langIdStr}`)}>Open Dashboard</button>
                <button className={styles.roadmapQuickBtn} onClick={() => router.push('/chat')}>Open Tutor Chat</button>
                <button className={styles.roadmapQuickBtn} onClick={() => router.push('/flashcards')}>Open Flashcards</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleNext = () => setStep(s => s + 1);
  
  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    else router.push('/learn');
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        handleNext();
      } else {
        alert("Oops! Something went wrong saving your plan: " + result.error);
        console.error(result.error);
      }
    } catch (e) {
      alert("Network exception. Please make sure you are connected.");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container} style={{ '--theme-color': langInfo.color } as React.CSSProperties}>
      
      {/* Top Bar with Back functionality and Progress Indicator */}
      {step < 5 && (
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Back
          </button>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${(step / 4) * 100}%`, backgroundColor: 'var(--theme-color)' }}
            />
          </div>
        </div>
      )}

      <div className={styles.contentWrapper}>
        
        {/* Step 1: Experience Level Screen */}
        {step === 1 && (
          <div className={styles.stepContainer}>
            <h1 className={styles.title}>What’s your current level in <span>{langInfo.name}</span>?</h1>
            <div className={styles.optionsGrid}>
              {LEVELS.map(lvl => (
                <div 
                  key={lvl.id}
                  className={`${styles.optionCard} ${formData.level === lvl.id ? styles.selected : ''}`}
                  onClick={() => setFormData({...formData, level: lvl.id})}
                >
                  <span className={styles.emoji}>{lvl.icon}</span>
                  <span className={styles.optionText}>{lvl.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.actionRow}>
              <button 
                className={styles.continueBtn} 
                onClick={handleNext} 
                disabled={!formData.level}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Daily Commitment Screen */}
        {step === 2 && (
          <div className={styles.stepContainer}>
            <h1 className={styles.title}>How much time can you commit daily?</h1>
            <div className={styles.timeGrid}>
              {TIMES.map(min => (
                <button
                  key={min}
                  className={`${styles.timeBtn} ${formData.commitment === min ? styles.selected : ''}`}
                  onClick={() => setFormData({...formData, commitment: min})}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className={styles.actionRow}>
              <button 
                className={styles.continueBtn} 
                onClick={handleNext} 
                disabled={!formData.commitment}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Reminder Setup Screen */}
        {step === 3 && (
          <div className={styles.stepContainer}>
            <h1 className={styles.title}>Let&apos;s set a daily reminder</h1>
            <div className={styles.reminderCard}>
              <div className={styles.toggleRow}>
                <span>Enable Notifications</span>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={formData.remindersEnabled}
                    onChange={(e) => setFormData({...formData, remindersEnabled: e.target.checked})}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              {formData.remindersEnabled && (
                <input 
                  type="time" 
                  className={styles.timePicker}
                  value={formData.reminderTime}
                  onChange={(e) => setFormData({...formData, reminderTime: e.target.value})}
                />
              )}
            </div>
            <div className={styles.actionRow}>
              <button 
                className={styles.continueBtn} 
                onClick={handleNext} 
              >
                Review & Setup
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Summary Overview Screen */}
        {step === 4 && (
          <div className={styles.stepContainer}>
            <div className={styles.successCard}>
              <h1 className={styles.title}>Review Your Plan!</h1>
              <div className={styles.summaryBox}>
                <p><strong>Language:</strong> {langInfo.name}</p>
                <p><strong>Target Goal:</strong> {formData.commitment} minutes/day</p>
                <p><strong>Reminders:</strong> {formData.remindersEnabled ? `Everyday at ${formData.reminderTime}` : 'Off'}</p>
              </div>
              <div className={styles.actionRow}>
                <button 
                  className={styles.continueBtn} 
                  onClick={handleComplete} 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Final: Success State */}
        {step === 5 && (
          <div className={styles.stepContainer}>
            <div className={styles.successCard}>
              <div className={styles.successIcon}>🎉</div>
              <h1 className={styles.title}>Your journey begins now!</h1>
              <p style={{fontSize: '1.2rem', color: '#555', marginBottom: '3rem', maxWidth: '400px', margin: '0 auto 3rem'}}>
                We&apos;ve officially set up your personalized {langInfo.name} learning curriculum.
              </p>
              <Link href={`/dashboard/${langIdStr}`} className={styles.continueBtn} style={{textDecoration: 'none', display: 'inline-block'}}>
                Start Learning
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
