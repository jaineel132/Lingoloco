"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import styles from './page.module.css';
import { ArrowLeft, RotateCw, X, Check, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useSupabaseAuth } from '@/components/AuthProvider';

type Flashcard = {
  id: number;
  word: string;
  pronunciation: string;
  translation: string;
  example: string;
  lang: string;
};

type FlashcardApiResponse = {
  success?: boolean;
  data?: Flashcard[];
  error?: string;
};

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish', fr: 'French', ja: 'Japanese', de: 'German',
  it: 'Italian', kr: 'Korean', zh: 'Chinese', pt: 'Portuguese',
  ru: 'Russian', hi: 'Hindi',
};

export default function FlashcardPage() {
  const { accessToken } = useSupabaseAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetLang, setTargetLang] = useState('es');

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const swipeOpacity = useTransform(x, [-100, 0, 100], [0.5, 1, 0.5]);

  const recordFlashcardProgress = useCallback(async () => {
    if (!accessToken) return;
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          activityType: 'flashcard',
          sessionMinutes: cards.length,
          xpEarned: Math.round(cards.length * 3),
          score: cards.length,
          totalQuestions: cards.length,
        }),
      });
    } catch { /* non-critical */ }
  }, [accessToken, cards.length]);

  useEffect(() => {
    if (completed) {
      void recordFlashcardProgress();
    }
  }, [completed, recordFlashcardProgress]);

  const currentCard = cards[currentIndex];
  const progress = cards.length === 0 ? 0 : completed ? 100 : (currentIndex / cards.length) * 100;

  useEffect(() => {
    const loadProfileLang = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch('/api/dashboard', {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        const json = await res.json();
        const lang = json?.data?.targetLanguage || 'es';
        setTargetLang(lang);
      } catch {
        // fall back to 'es'
      }
    };
    void loadProfileLang();
  }, [accessToken]);

  const fetchDeck = async (langOverride?: string) => {
    setIsLoading(true);
    setError('');

    const activeLang = (langOverride && typeof langOverride === 'string' ? langOverride : targetLang) || 'es';
    const langName = LANGUAGE_NAMES[activeLang] || 'Spanish';

    try {
      const response = await fetch(`/api/flashcards?lang=${activeLang}&languageName=${langName}&count=5&t=${Date.now()}`, { cache: 'no-store' });
      const json = (await response.json()) as FlashcardApiResponse;

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setCards(json.data);
        setCurrentIndex(0);
        setIsFlipped(false);
        setCompleted(false);
        x.set(0);
      } else {
        setError(json.error || 'Failed to load flashcards');
      }
    } catch (requestError) {
      console.error(requestError);
      setError('Failed to load flashcards');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeck();
  }, []);

  const handleNext = () => {
    if (cards.length === 0) {
      return;
    }

    setIsFlipped(false);

    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        x.set(0);
      } else {
        setCompleted(true);
      }
    }, 150);
  };

  const handleDragEnd = (_event: unknown, info: { offset: { x: number } }) => {
    if (Math.abs(info.offset.x) > 100) {
      handleNext();
    }
  };

  const handleFlip = () => {
    if (!currentCard) {
      return;
    }

    if (Math.abs(x.get()) < 10) {
      setIsFlipped(!isFlipped);
    }
  };

  const playAudio = (text: string, langCode: string) => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    window.speechSynthesis.speak(utterance);
  };

  if (isLoading) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.contentZIndex} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
          <div className={styles.completionContainer}>
            <h1 className={styles.finishTitle}>Building your deck...</h1>
            <p className={styles.finishText}>AI is generating fresh flashcards for this visit.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || cards.length === 0) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.contentZIndex} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
          <div className={styles.completionContainer}>
            <h1 className={styles.finishTitle}>Could not load flashcards</h1>
            <p className={styles.finishText}>{error || 'Please try again.'}</p>
            <button className={styles.finishBtn} onClick={() => fetchDeck()}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.blob1}></div>
        <div className={styles.blob2}></div>
        <div className={styles.blob3}></div>

        <div className={styles.contentZIndex}>
          <div className={styles.header}>
            <Link href={`/dashboard/${targetLang}`} className={styles.backBtn}>
              <ArrowLeft size={24} />
            </Link>
            <div style={{ width: 48 }}></div>
          </div>

          <div className={styles.completionContainer}>
            <div className={styles.trophy}>🏆</div>
            <h1 className={styles.finishTitle}>Deck Completed!</h1>
                    <p className={styles.finishText}>You&apos;ve successfully reviewed all your flashcards for today. Keep up the great work and your knowledge will grow!</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className={styles.finishBtn} onClick={() => fetchDeck(targetLang)}>New AI Deck</button>
              <Link href={`/dashboard/${targetLang}`}>
                <button className={styles.finishBtn}>Back to Dashboard</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>
      <div className={styles.blob3}></div>

      <div className={styles.contentZIndex}>
        <div className={styles.header}>
          <Link href={`/dashboard/${targetLang}`} className={styles.backBtn}>
            <ArrowLeft size={24} />
          </Link>
          <div style={{ textAlign: 'center' }}>
            <h1 className={styles.title}>Daily Review</h1>
            <p className={styles.subtitle}>{LANGUAGE_NAMES[targetLang] || 'Language'} Essentials</p>
          </div>
          <div style={{ width: 48 }}></div>
        </div>

        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span>Session Progress</span>
            <span>{currentIndex + 1} of {cards.length}</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className={styles.cardArea}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ x: 0, y: 50, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, type: 'spring', bounce: 0.4 }}
              className={styles.cardContainer}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x, rotate, opacity: swipeOpacity }}
              onClick={handleFlip}
            >
              <div className={`${styles.cardInner} ${isFlipped ? styles.isFlipped : ''}`}>
                <div className={styles.cardFace}>
                  <div className={styles.cardTopRow}>
                    <div className={styles.langBadge}>{currentCard.lang}</div>
                      <div className={styles.soundBtn} onClick={(event) => { event.stopPropagation(); playAudio(currentCard.word, `${targetLang}-${targetLang.toUpperCase()}`); }}>
                      <Volume2 size={18} />
                    </div>
                  </div>
                  <h2 className={styles.word}>{currentCard.word}</h2>
                  <p className={styles.pronunciation}>/{currentCard.pronunciation}/</p>
                  <div className={styles.hint}>
                    <RotateCw size={16} /> Tap to flip • Swipe to answer
                  </div>
                </div>

                <div className={`${styles.cardFace} ${styles.cardBack}`}>
                  <div className={styles.cardTopRow}>
                    <div className={styles.langBadge}>Translation</div>
                    <div className={styles.soundBtn} onClick={(event) => { event.stopPropagation(); playAudio(currentCard.translation, 'en-US'); }}>
                      <Volume2 size={18} />
                    </div>
                  </div>
                  <h2 className={styles.translation}>{currentCard.translation}</h2>
                  <p className={styles.example}>&quot;{currentCard.example}&quot;</p>
                  <div className={styles.hint}>
                    <RotateCw size={16} /> Tap to turn back
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.controls}>
          <button className={styles.btnHard} onClick={(event) => { event.stopPropagation(); handleNext(); }}>
            <X size={24} />
            <span>Still Learning</span>
          </button>
          <button className={styles.btnEasy} onClick={(event) => { event.stopPropagation(); handleNext(); }}>
            <Check size={24} />
            <span>Got It!</span>
          </button>
        </div>
      </div>
    </div>
  );
}
