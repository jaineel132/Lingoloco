'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import styles from './Practice.module.css';
import { X, Loader2, Volume2 } from 'lucide-react';
import { useSupabaseAuth } from '../../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../../lib/supabase/clientFetch';

type UnitStatus = 'completed' | 'current' | 'locked';
type PracticeType = 'multiple_choice' | 'fill_in_the_blank' | 'matching' | 'reorder_sentence' | 'translation';

type PracticeUnit = {
  id: number;
  label: string;
  icon: string;
  status: UnitStatus;
  topic: string;
};

type PracticeSet = {
  id: number;
  label: string;
  icon: string;
  topic: string;
};

type PracticeSession = {
  id: number;
  label: string;
  icon: string;
  status: UnitStatus;
  description: string;
  sets: PracticeSet[];
};

type PracticeQuestion = {
  type: PracticeType;
  title: string;
  scenario: string;
  question: string;
  audioText: string;
  options?: string[];
  words?: string[];
  answer: string;
  acceptedAnswers?: string[];
  explanation: string;
};

type PracticeApiResponse = {
  success?: boolean;
  data?: unknown;
  error?: string;
};

type ProgressSummary = {
  xp: number;
  streak: number;
  dailyGoalMinutes: number;
  dailyProgressMinutes: number;
  dailyProgressPercent: number;
  dailyQuest?: {
    xpGoal: number;
    xpCurrent: number;
    xpPercent: number;
    xpCompleted: boolean;
    scenariosGoal: number;
    scenariosCurrent: number;
    scenariosPercent: number;
    scenariosCompleted: boolean;
  };
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

type ProgressApiResponse = {
  success?: boolean;
  data?: {
    progressSummary?: ProgressSummary;
  } | null;
  error?: string;
};

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  ja: 'Japanese',
  de: 'German',
  it: 'Italian',
  kr: 'Korean',
  zh: 'Chinese',
  pt: 'Portuguese',
  ru: 'Russian',
  hi: 'Hindi',
};

const LOCALE_MAP: Record<string, string> = {
  es: 'es-ES',
  fr: 'fr-FR',
  ja: 'ja-JP',
  de: 'de-DE',
  it: 'it-IT',
  kr: 'ko-KR',
  zh: 'zh-CN',
  pt: 'pt-BR',
  ru: 'ru-RU',
  hi: 'hi-IN',
};

const SESSION_BLUEPRINTS: Array<{ label: string; icon: string; description: string; setTopics: string[] }> = [
  {
    label: 'Session 1',
    icon: '🌱',
    description: 'Core greetings and survival phrases.',
    setTopics: [
      'basic greetings',
      'introducing yourself',
      'saying goodbye',
      'being polite',
      'numbers and time',
      'asking simple questions',
      'classroom basics',
    ],
  },
  {
    label: 'Session 2',
    icon: '👋',
    description: 'First conversations and personal details.',
    setTopics: [
      'name and nationality',
      'where you live',
      'age and occupation',
      'likes and dislikes',
      'family words',
      'daily routines',
      'simple introductions',
    ],
  },
  {
    label: 'Session 3',
    icon: '✈️',
    description: 'Travel essentials for moving around town.',
    setTopics: [
      'asking for directions',
      'taking a taxi',
      'train and bus basics',
      'airport phrases',
      'hotel check-in',
      'city navigation',
      'emergency travel phrases',
    ],
  },
  {
    label: 'Session 4',
    icon: '🍜',
    description: 'Food, drinks, and ordering politely.',
    setTopics: [
      'ordering at a restaurant',
      'asking for the menu',
      'drinks and snacks',
      'dietary preferences',
      'restaurant payment',
      'takeout and delivery',
      'food vocabulary',
    ],
  },
  {
    label: 'Session 5',
    icon: '🛍️',
    description: 'Shopping for clothes, gifts, and prices.',
    setTopics: [
      'asking prices',
      'clothing sizes',
      'colors and materials',
      'shopping politely',
      'trying things on',
      'paying in a store',
      'returning items',
    ],
  },
  {
    label: 'Session 6',
    icon: '🏠',
    description: 'Home, routines, and everyday needs.',
    setTopics: [
      'house and rooms',
      'chores and cleaning',
      'making plans',
      'talking about the weather',
      'daily habits',
      'keeping appointments',
      'asking for help',
    ],
  },
  {
    label: 'Session 7',
    icon: '👨‍👩‍👧',
    description: 'Family, friends, and relationships.',
    setTopics: [
      'family members',
      'friends and colleagues',
      'describing people',
      'birthday and celebration phrases',
      'inviting someone out',
      'talking about hobbies',
      'simple conversations',
    ],
  },
  {
    label: 'Session 8',
    icon: '💼',
    description: 'Work, study, and planning ahead.',
    setTopics: [
      'school and learning',
      'workplace basics',
      'scheduling and calendars',
      'writing simple messages',
      'meeting and deadlines',
      'phone and email basics',
      'asking about jobs',
    ],
  },
  {
    label: 'Session 9',
    icon: '🎭',
    description: 'Social situations and real-life conversations.',
    setTopics: [
      'making plans with friends',
      'at a cafe',
      'talking about hobbies',
      'watching movies and music',
      'expressing opinions',
      'agreeing and disagreeing',
      'casual conversation',
    ],
  },
  {
    label: 'Session 10',
    icon: '🏆',
    description: 'Review and confidence-building practice.',
    setTopics: [
      'review greetings',
      'review travel phrases',
      'review food phrases',
      'review shopping phrases',
      'review family phrases',
      'review daily routines',
      'final mixed review',
    ],
  },
];

const BUILD_SETS = (session: typeof SESSION_BLUEPRINTS[number]): PracticeSet[] =>
  session.setTopics.map((topic, index) => ({
    id: index + 1,
    label: `Set ${index + 1}`,
    icon: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'][index] || '🔹',
    topic,
  }));

const PRACTICE_SESSIONS: PracticeSession[] = SESSION_BLUEPRINTS.map((session, index) => ({
  id: index + 1,
  label: session.label,
  icon: session.icon,
  status: index < 3 ? 'completed' : index === 3 ? 'current' : 'locked',
  description: session.description,
  sets: BUILD_SETS(session),
}));

const DEFAULT_PROGRESS: ProgressSummary = {
  xp: 0,
  streak: 0,
  dailyGoalMinutes: 10,
  dailyProgressMinutes: 0,
  dailyProgressPercent: 0,
  dailyQuest: {
    xpGoal: 50,
    xpCurrent: 0,
    xpPercent: 0,
    xpCompleted: false,
    scenariosGoal: 2,
    scenariosCurrent: 0,
    scenariosPercent: 0,
    scenariosCompleted: false,
  },
  dailyGoalReached: false,
  lessonsCompleted: 0,
  totalTimeHours: 0,
  progressMessage: 'Start a lesson to begin tracking progress',
};

export default function PracticePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { accessToken } = useSupabaseAuth();
  const lang = typeof params?.lang === 'string' ? params.lang : 'es';
  const languageName = LANGUAGE_NAMES[lang] || 'this language';

  const [activeSession, setActiveSession] = useState<PracticeSession | null>(null);
  const [activeSet, setActiveSet] = useState<PracticeSet | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [setPickerOpen, setSetPickerOpen] = useState(false);
  
  const [practiceData, setPracticeData] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [wordOrder, setWordOrder] = useState<string[]>([]);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [answerCorrect, setAnswerCorrect] = useState(false);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary>(DEFAULT_PROGRESS);
  const sessionStartedAtRef = useRef<number | null>(null);
  const completionSavedRef = useRef(false);
  const autoOpenHandledRef = useRef(false);

  const normalizeText = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["'“”‘’.,!?¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const shuffleWords = (words: string[]) => [...words].sort(() => Math.random() - 0.5);

  const currentQ = practiceData[currentIndex];
  const roadmap = progressSummary.practiceRoadmap;
  const dailyQuest = progressSummary.dailyQuest || DEFAULT_PROGRESS.dailyQuest;

  const refreshProgress = async () => {
    try {
      if (!accessToken) {
        return;
      }

      const response = await fetch('/api/progress', withSupabaseAuthHeaders(accessToken, { cache: 'no-store' }));
      const json = (await response.json()) as ProgressApiResponse;

      if (json.success && json.data?.progressSummary) {
        setProgressSummary(json.data.progressSummary);
      }
    } catch (error) {
      console.error('Failed to load progress summary:', error);
    }
  };

  useEffect(() => {
    void refreshProgress();
  }, [accessToken]);

  useEffect(() => {
    if (autoOpenHandledRef.current) {
      return;
    }

    const sessionParam = searchParams.get('session');
    const setParam = searchParams.get('set');
    if (!sessionParam || !setParam) {
      return;
    }

    const sessionId = Number(sessionParam);
    const setId = Number(setParam);
    if (!Number.isFinite(sessionId) || !Number.isFinite(setId)) {
      return;
    }

    const sessionItem = PRACTICE_SESSIONS.find((item) => item.id === sessionId);
    const setItem = sessionItem?.sets.find((item) => item.id === setId);
    if (!sessionItem || !setItem) {
      return;
    }

    autoOpenHandledRef.current = true;
    startSetPractice(sessionItem, setItem);
  }, [searchParams]);

  useEffect(() => {
    if (!currentQ) {
      return;
    }

    setSelectedOption(null);
    setTypedAnswer('');
    setAnswerLocked(false);
    setAnswerCorrect(false);

    if (currentQ.type === 'reorder_sentence') {
      const baseWords = currentQ.words?.length ? currentQ.words : currentQ.answer.split(/\s+/).filter(Boolean);
      setWordBank(shuffleWords(baseWords));
      setWordOrder([]);
    } else {
      setWordBank([]);
      setWordOrder([]);
    }
  }, [currentQ]);

  const handleSessionClick = (sessionItem: PracticeSession) => {
    if (sessionItem.status === 'locked') return;

    setActiveSession(sessionItem);
    setActiveSet(null);
    setSetPickerOpen(true);
  };

  const startSetPractice = async (sessionItem: PracticeSession, setItem: PracticeSet) => {
    setActiveSession(sessionItem);
    setActiveSet(setItem);
    setSetPickerOpen(false);
    setModalOpen(true);
    setIsAiLoading(true);
    setPracticeData([]);
    setCurrentIndex(0);
    setScore(0);
    setLessonComplete(false);
    setSelectedOption(null);
    completionSavedRef.current = false;
    sessionStartedAtRef.current = Date.now();

    try {
      const res = await fetch('/api/practice', withSupabaseAuthHeaders(accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          languageName,
          topic: setItem.topic,
          section: `${sessionItem.label} • ${setItem.label}`,
        })
      }));
      const json = (await res.json()) as PracticeApiResponse;
      if (json.success && Array.isArray(json.data)) {
        setPracticeData(json.data as PracticeQuestion[]);
      } else {
        alert("Failed to load scenarios: " + (json.error || 'Invalid layout'));
        setModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      alert("Network error.");
      setModalOpen(false);
    } finally {
      setIsAiLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveSet(null);
  };

  const finishAnswer = (correct: boolean) => {
    setAnswerLocked(true);
    setAnswerCorrect(correct);
    if (correct) {
      setScore((currentScore) => currentScore + 1);
    }
  };

  const saveLessonProgress = async () => {
    if (completionSavedRef.current) {
      return;
    }

    completionSavedRef.current = true;

    const startedAt = sessionStartedAtRef.current ?? Date.now();
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));

    try {
      await fetch('/api/progress', withSupabaseAuthHeaders(accessToken, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionMinutes: elapsedMinutes,
          score,
          totalQuestions: practiceData.length,
          sessionId: activeSession?.id,
          setId: activeSet?.id,
          sessionLabel: activeSession?.label,
          setLabel: activeSet?.label,
          totalSessions: PRACTICE_SESSIONS.length,
          setsPerSession: activeSession?.sets.length || 7,
        }),
      }));
      await refreshProgress();
    } catch (error) {
      console.error('Failed to save lesson progress:', error);
      completionSavedRef.current = false;
    }
  };

  const handleOptionClick = (opt: string) => {
    if (answerLocked || lessonComplete || practiceData.length === 0 || !currentQ) return;

    setSelectedOption(opt);
    finishAnswer(normalizeText(opt) === normalizeText(currentQ.answer));
  };

  const handleSubmitTranslation = () => {
    if (answerLocked || !currentQ) return;

    const acceptedAnswers = currentQ.acceptedAnswers?.length ? currentQ.acceptedAnswers : [currentQ.answer];
    const normalizedAttempt = normalizeText(typedAnswer);
    const isCorrect = acceptedAnswers.some((candidate) => normalizeText(candidate) === normalizedAttempt);
    finishAnswer(isCorrect);
  };

  const addWord = (word: string) => {
    if (answerLocked) return;
    setWordOrder((currentOrder) => [...currentOrder, word]);
    setWordBank((currentBank) => currentBank.filter((item, index) => !(item === word && currentBank.indexOf(item) === index)));
  };

  const removeWord = (index: number) => {
    if (answerLocked) return;
    setWordOrder((currentOrder) => {
      const nextOrder = [...currentOrder];
      const [removed] = nextOrder.splice(index, 1);
      if (removed) {
        setWordBank((currentBank) => [...currentBank, removed]);
      }
      return nextOrder;
    });
  };

  const submitWordOrder = () => {
    if (answerLocked || !currentQ) return;

    const expected = normalizeText(currentQ.answer);
    const attempt = normalizeText(wordOrder.join(' '));
    finishAnswer(attempt === expected);
  };

  const handleNextQuestion = async () => {
    if (currentIndex < practiceData.length - 1) {
      setCurrentIndex(curr => curr + 1);
      setSelectedOption(null);
    } else {
      await saveLessonProgress();
      setLessonComplete(true);
    }
  };

  const playAudio = (text: string) => {
    if (!text) return;
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = LOCALE_MAP[lang] || lang;
    window.speechSynthesis.speak(ut);
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>{languageName} from Scratch</h1>
        <p className={styles.subtitle}>Choose a session, pick one of its 7 sets, and complete 10 AI-generated practice exercises for that set.</p>
      </div>

      <div className={styles.contentGrid}>
        
        {/* Roadmap Path */}
        <div className={styles.roadmapContainer}>
          <div className={styles.roadmapLine}></div>
          
          {PRACTICE_SESSIONS.map((sessionItem, index) => {
            const offset = Math.sin((index + 0.5) * 1.5) * 120;
            return (
              <div 
                key={sessionItem.id}
                className={`${styles.nodeWrapper} ${styles[sessionItem.status]}`} 
                style={{ transform: `translateX(${offset}px)` }}
                onClick={() => handleSessionClick(sessionItem)}
              >
                <div className={styles.nodeIcon}>
                  {sessionItem.icon}
                </div>
                <div className={styles.nodeLabel}>{sessionItem.id}. {sessionItem.label}</div>
              </div>
            );
          })}
        </div>

        {/* Right Sidebar */}
        <div className={styles.sidebar}>
          
          <div className={styles.sideCard}>
            <h3>Daily Quests</h3>
            
            <div className={styles.questItem}>
              <div className={styles.questIcon}>🎯</div>
              <div className={styles.questInfo}>
                <h4>Earn 50 XP</h4>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{width: `${dailyQuest?.xpPercent ?? 0}%`}}></div>
                </div>
                <p>{dailyQuest?.xpCurrent ?? 0} / {dailyQuest?.xpGoal ?? 50} XP</p>
              </div>
            </div>

            <div className={styles.questItem}>
              <div className={styles.questIcon}>🎭</div>
              <div className={styles.questInfo}>
                <h4>Complete 2 Scenarios</h4>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{width: `${dailyQuest?.scenariosPercent ?? 0}%`}}></div>
                </div>
                <p>{dailyQuest?.scenariosCurrent ?? 0} / {dailyQuest?.scenariosGoal ?? 2}</p>
              </div>
            </div>
            
          </div>

          <div className={styles.sideCard}>
            <h3>Current Streak 🔥</h3>
            <h1 style={{fontSize: '3rem', margin: '0 0 1rem 0', color: '#FF9F1C'}}>
              {progressSummary.streak}
              <span style={{fontSize:'1.5rem', color:'#888'}}> Days</span>
            </h1>
            <p style={{margin: 0, color: '#666'}}>{progressSummary.progressMessage}</p>
            <p style={{margin: '0.65rem 0 0', color: '#888', fontSize: '0.9rem'}}>{progressSummary.xp} XP earned</p>
            <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', borderRadius: '18px', background: '#f8fcfc', border: '1px solid rgba(9, 124, 135, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <strong style={{ color: '#1a1a1a' }}>Current Path</strong>
                <span style={{ color: '#097C87', fontWeight: 700 }}>{roadmap?.roadmapProgressPercent ?? 0}%</span>
              </div>
              <p style={{ margin: '0.35rem 0 0', color: '#555', fontSize: '0.92rem' }}>{roadmap?.nextActionLabel ?? 'Session 1 • Set 1'}</p>
              <p style={{ margin: '0.35rem 0 0', color: '#888', fontSize: '0.85rem' }}>
                {roadmap ? `${roadmap.completedSessions}/${roadmap.totalSessions} sessions • ${roadmap.completedSets}/${roadmap.totalSets} sets` : '0/10 sessions • 0/70 sets'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Session Set Picker */}
      {setPickerOpen && activeSession && (
        <div className={styles.modalOverlay} onClick={() => setSetPickerOpen(false)}>
          <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setSetPickerOpen(false)}><X size={24} /></button>
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>{activeSession.icon}</div>
              <div className={styles.headerInfo}>
                <h2>{activeSession.label}</h2>
                <p style={{ margin: 0, color: '#666' }}>{activeSession.description}</p>
                <p style={{ margin: '0.35rem 0 0', color: '#888', fontSize: '0.9rem' }}>Choose 1 of 7 sets. Each set generates 10 questions.</p>
              </div>
            </div>

            <div className={styles.setGrid}>
              {activeSession.sets.map((setItem) => (
                <button key={setItem.id} className={styles.setCard} onClick={() => startSetPractice(activeSession, setItem)}>
                  <span className={styles.setIcon}>{setItem.icon}</span>
                  <span className={styles.setLabel}>{setItem.label}</span>
                  <span className={styles.setTopic}>{setItem.topic}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Practice Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={closeModal}><X size={24} /></button>
            
            {lessonComplete ? (
              <div className={styles.lessonCompleteBox}>
                <div className={styles.victoryIcon}>🏆</div>
                <h2>Lesson Complete!</h2>
                <p className={styles.scoreText}>You scored <strong>{score}</strong> out of {practiceData.length}</p>
                <button className={styles.finishBtn} onClick={() => router.replace(`/dashboard/${lang}?updated=${Date.now()}`)}>Continue Learning</button>
              </div>
            ) : (
              <>
                <div className={styles.modalHeader}>
                  <div className={styles.modalIcon}>{activeSession?.icon}</div>
                  <div className={styles.headerInfo}>
                    <h2>{activeSession?.label} - {activeSet?.label}</h2>
                    <p style={{ margin: '0.25rem 0 0', color: '#666' }}>{activeSet?.topic}</p>
                    {!isAiLoading && practiceData.length > 0 && (
                      <div className={styles.lessonProgressContainer}>
                        <div className={styles.lessonProgressBar}>
                          <div className={styles.lessonProgressFill} style={{width: `${(currentIndex / practiceData.length) * 100}%`}}></div>
                        </div>
                        <span className={styles.lessonProgressText}>{currentIndex + 1} / {practiceData.length}</span>
                      </div>
                    )}
                  </div>
                </div>

                {isAiLoading ? (
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem'}}>
                     <Loader2 size={48} color="#097C87" className={styles.spinner} style={{animation: 'spin 2s linear infinite'}} />
                    <p style={{marginTop: '1rem', color: '#555'}}>AI is building 10 beginner exercises for this set...</p>
                     <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : practiceData.length > 0 && currentQ ? (
                  <div className={styles.questionContainer}>
                    
                    <div className={styles.questionBox}>
                      <div className={styles.questionHeader}>
                         <h3>
                           {currentQ.type === 'fill_in_the_blank' && '✍️ Fill in the Blank'}
                           {currentQ.type === 'multiple_choice' && '🤔 Multiple Choice'}
                           {currentQ.type === 'matching' && '🔗 Matching'}
                           {currentQ.type === 'reorder_sentence' && '🧩 Put in Order'}
                           {currentQ.type === 'translation' && '📝 Translate It'}
                         </h3>
                         {currentQ.audioText && (
                           <button className={styles.audioBtn} onClick={() => playAudio(currentQ.audioText)} title="Listen">
                             <Volume2 size={20} />
                           </button>
                         )}
                      </div>
                      
                      <div className={styles.scenarioText}>&ldquo;{currentQ.scenario}&rdquo;</div>
                      <p className={styles.mainQuestionText}>
                        {currentQ.type === 'fill_in_the_blank' ? (
                          currentQ.question.split('___').map((part: string, idx: number, arr: string[]) => (
                             <React.Fragment key={idx}>
                                {part}
                                {idx < arr.length - 1 && <span className={styles.blankSpace}></span>}
                             </React.Fragment>
                          ))
                        ) : currentQ.type === 'reorder_sentence' ? (
                          currentQ.question
                        ) : (
                          currentQ.question
                        )}
                      </p>
                    </div>

                    {(currentQ.type === 'multiple_choice' || currentQ.type === 'fill_in_the_blank' || currentQ.type === 'matching') && currentQ.options && (
                      <div className={styles.optionsGrid}>
                        {currentQ.options.map((opt: string, idx: number) => {
                          const isCorrect = normalizeText(opt) === normalizeText(currentQ.answer);
                          const isSelected = selectedOption === opt;
                          
                          let btnClass = styles.optionBtn;
                          if (answerLocked) {
                             if (isSelected && isCorrect) btnClass += ` ${styles.selectedCorrect}`;
                             else if (isSelected && !isCorrect) btnClass += ` ${styles.selectedWrong}`;
                             else if (isCorrect) btnClass += ` ${styles.selectedCorrect}`;
                          }

                          return (
                            <button 
                              key={idx} 
                              className={btnClass}
                              onClick={() => handleOptionClick(opt)}
                              disabled={answerLocked}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {currentQ.type === 'reorder_sentence' && (
                      <div className={styles.reorderContainer}>
                        <div className={styles.reorderBank}>
                          <div className={styles.reorderLabel}>Word bank</div>
                          <div className={styles.wordChipGrid}>
                            {wordBank.map((word, index) => (
                              <button key={`${word}-${index}`} className={styles.wordChip} onClick={() => addWord(word)} disabled={answerLocked}>
                                {word}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={styles.reorderBank}>
                          <div className={styles.reorderLabel}>Your sentence</div>
                          <div className={styles.wordOrderRow}>
                            {wordOrder.length === 0 ? (
                              <span className={styles.wordOrderPlaceholder}>Tap words to build the sentence</span>
                            ) : (
                              wordOrder.map((word, index) => (
                                <button key={`${word}-${index}`} className={styles.wordOrderChip} onClick={() => removeWord(index)} disabled={answerLocked}>
                                  {word}
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        <button className={styles.submitBtn} onClick={submitWordOrder} disabled={answerLocked || wordOrder.length === 0}>
                          Check Sentence
                        </button>
                      </div>
                    )}

                    {currentQ.type === 'translation' && (
                      <div className={styles.translationContainer}>
                        <input
                          className={styles.translationInput}
                          type="text"
                          value={typedAnswer}
                          onChange={(event) => setTypedAnswer(event.target.value)}
                          placeholder="Type your translation here"
                          disabled={answerLocked}
                        />
                        <button className={styles.submitBtn} onClick={handleSubmitTranslation} disabled={answerLocked || !typedAnswer.trim()}>
                          Check Translation
                        </button>
                      </div>
                    )}

                    {answerLocked && (
                       <div className={`${styles.feedbackBox} ${answerCorrect ? styles.correct : styles.wrong}`}>
                          <div className={styles.feedbackHeader}>
                            <strong>{answerCorrect ? 'Great job! 🎉' : 'Not quite! 😅'}</strong>
                            <button className={styles.nextBtn} onClick={handleNextQuestion}>
                              {currentIndex < practiceData.length - 1 ? 'Next Question ➔' : 'Finish Lesson ➔'}
                            </button>
                          </div>
                          <p style={{marginTop:'0.5rem', marginBottom: 0}}>{currentQ.explanation}</p>
                       </div>
                    )}
                  </div>
                ) : (
                   <div style={{textAlign: 'center', color: '#888'}}>Failed to load questions.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
