'use client';

import React, { useEffect, useMemo, useRef, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Minus, Plus, Sparkles } from 'lucide-react';
import styles from './page.module.css';
import { createBrowserClient } from '@/lib/supabase/browser';

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  targetLanguage: string | null;
  level: string | null;
  xp: number | null;
};

type DuelMatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  elo_change_p1: number | null;
  elo_change_p2: number | null;
  language: string | null;
  played_at: string;
};

type DuelResultSummary = {
  winnerNewElo: number;
  loserNewElo: number;
  winnerChange: number;
  loserChange: number;
};

function formatSignedNumber(value: number) {
  return `${value > 0 ? '+' : ''}${value}`;
}

function buildResultBanner(summary: DuelResultSummary) {
  const xpEarned = 50 + summary.winnerChange;
  return `${formatSignedNumber(summary.winnerChange)} Elo for the winner, ${formatSignedNumber(summary.loserChange)} Elo for the loser, ${formatSignedNumber(xpEarned)} XP earned`;
}

export default function DuelSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const unwrappedParams = use(params);

  const [currentUser, setCurrentUser] = useState<ProfileRow | null>(null);
  const [opponent, setOpponent] = useState<ProfileRow | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [resultLabel, setResultLabel] = useState('');

  const redirectTimerRef = useRef<number | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const language = useMemo(() => {
    return opponent?.targetLanguage || currentUser?.targetLanguage || 'Spanish';
  }, [opponent?.targetLanguage, currentUser?.targetLanguage]);

  const winnerCandidate = myScore === opponentScore ? null : myScore > opponentScore ? 'me' : 'opponent';

  const clearRedirectTimer = () => {
    if (redirectTimerRef.current) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  };

  const scheduleRedirect = () => {
    clearRedirectTimer();
    redirectTimerRef.current = window.setTimeout(() => {
      router.replace('/compete');
    }, 3000);
  };

  const applyResultRow = (row: DuelMatchRow) => {
    if (!currentUser || !opponent) return;

    const winnerIsPlayer1 = row.winner_id === row.player1_id;
    const winnerChange = winnerIsPlayer1 ? Number(row.elo_change_p1 || 0) : Number(row.elo_change_p2 || 0);
    const loserChange = winnerIsPlayer1 ? Number(row.elo_change_p2 || 0) : Number(row.elo_change_p1 || 0);
    const xpEarned = 50 + winnerChange;
    const winnerName = row.winner_id === currentUser.id ? 'You' : (opponent.name || 'Opponent');
    const loserName = row.winner_id === currentUser.id ? (opponent.name || 'Opponent') : 'You';

    setResultLabel(`${winnerName} defeated ${loserName}. ${formatSignedNumber(winnerChange)} Elo, ${formatSignedNumber(loserChange)} Elo, ${formatSignedNumber(xpEarned)} XP earned.`);
    setBannerMessage('Duel complete. Redirecting back to Compete...');
    scheduleRedirect();
  };

  useEffect(() => {
    let active = true;

    const loadPlayers = async () => {
      setLoading(true);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData?.user ?? null;
        if (!user) {
          throw new Error('Please sign in to play duels.');
        }

        const [{ data: myProfile, error: myProfileError }, { data: opponentProfile, error: opponentError }] = await Promise.all([
          supabase.from('profiles').select('id,name,email,image,targetLanguage,level,xp').eq('id', user.id).maybeSingle(),
          supabase.from('profiles').select('id,name,email,image,targetLanguage,level,xp').eq('id', unwrappedParams.id).maybeSingle(),
        ]);

        if (myProfileError) throw myProfileError;
        if (opponentError) throw opponentError;
        if (!opponentProfile) {
          throw new Error('Opponent not found.');
        }

        if (!active) return;

        setCurrentUser(myProfile ?? null);
        setOpponent(opponentProfile);

        // Starting a fresh duel session, so we don't automatically redirect based on past match history
      } catch (error: any) {
        if (!active) return;
        setBannerMessage(error?.message || 'Could not load duel session.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPlayers();

    return () => {
      active = false;
    };
  }, [supabase, unwrappedParams.id]);

  useEffect(() => {
    if (!currentUser || !opponent) return;

    const channel = supabase
      .channel(`duel-matches:${currentUser.id}:${opponent.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duel_matches' }, (payload: any) => {
        const row = payload.new as DuelMatchRow;
        const isThisMatch =
          (row.player1_id === currentUser.id && row.player2_id === opponent.id) ||
          (row.player1_id === opponent.id && row.player2_id === currentUser.id);

        if (isThisMatch) {
          applyResultRow(row);
        }
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        void supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [currentUser, opponent, supabase]);

  useEffect(() => {
    return () => {
      clearRedirectTimer();
    };
  }, []);

  const finishDuel = async () => {
    if (!currentUser || !opponent || processing || myScore === opponentScore) {
      if (myScore === opponentScore) {
        setBannerMessage('The duel is tied. Add one more point to break the tie.');
      }
      return;
    }

    setProcessing(true);
    setBannerMessage('Saving duel result...');

    const winner = myScore > opponentScore ? currentUser : opponent;
    const loser = myScore > opponentScore ? opponent : currentUser;

    try {
      const response = await fetch('/api/compete/duel-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1Id: currentUser.id,
          player2Id: opponent.id,
          player1Score: myScore,
          player2Score: opponentScore,
          winnerId: winner.id,
          loserId: loser.id,
          language,
        }),
      });

      const json = (await response.json()) as DuelResultSummary & { error?: string };

      if (!response.ok) {
        throw new Error(json?.error || 'Failed to save duel result.');
      }

      setResultLabel(`Result saved. ${buildResultBanner(json)}`);
      setBannerMessage('Duel complete. Redirecting back to Compete...');
      scheduleRedirect();
    } catch (error: any) {
      setBannerMessage(error?.message || 'Failed to save duel result.');
    } finally {
      setProcessing(false);
    }
  };

  const winnerText = winnerCandidate === 'me' ? 'You are ahead' : winnerCandidate === 'opponent' ? `${opponent?.name || 'Opponent'} is ahead` : 'Tie game';

  return (
    <div className={styles.wrapper}>
      <div className={styles.glowA} />
      <div className={styles.glowB} />

      <div className={styles.topbar}>
        <Link href="/compete" className={styles.backBtn}>
          <ArrowLeft size={20} />
          Back
        </Link>
        <div className={styles.topbarMeta}>
          <span className={styles.badge}><Sparkles size={14} /> Live Duel</span>
          <span className={styles.language}>{language}</span>
        </div>
      </div>

      <main className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Competitive Match</p>
            <h1>Duel Arena</h1>
            <p className={styles.heroCopy}>
              Track the score, finish the match, and let the ranking system handle Elo, XP, and league updates.
            </p>
          </div>
          <div className={styles.heroStat}>
            <Trophy size={20} />
            <span>{winnerText}</span>
          </div>
        </section>

        {bannerMessage ? <div className={styles.banner}>{bannerMessage}</div> : null}
        {resultLabel ? <div className={styles.resultBanner}>{resultLabel}</div> : null}

        <section className={styles.arena}>
          <article className={styles.playerCard}>
            <div className={styles.playerHead}>
              <div className={styles.avatar}>{(currentUser?.name || 'You').charAt(0).toUpperCase()}</div>
              <div>
                <p className={styles.playerLabel}>You</p>
                <h2>{currentUser?.name || 'Learner'}</h2>
                <p className={styles.playerSub}>{currentUser?.level || 'Beginner'} • {currentUser?.xp ?? 0} XP</p>
              </div>
            </div>
            <div className={styles.score}>{myScore}</div>
            <div className={styles.scoreControls}>
              <button type="button" className={styles.scoreBtn} onClick={() => setMyScore((value) => Math.max(0, value - 1))}>
                <Minus size={16} />
                Remove point
              </button>
              <button type="button" className={styles.scoreBtnPrimary} onClick={() => setMyScore((value) => value + 1)}>
                <Plus size={16} />
                Add point
              </button>
            </div>
          </article>

          <div className={styles.vsColumn}>
            <div className={styles.vsPill}>VS</div>
            <p className={styles.vsNote}>First one to finish decides the final result.</p>
            <button type="button" className={styles.finishBtn} onClick={finishDuel} disabled={processing || loading || !currentUser || !opponent}>
              {processing ? 'Saving...' : 'Finish Duel'}
            </button>
            <p className={styles.vsHint}>If the score is tied, add one more point before finishing.</p>
          </div>

          <article className={styles.playerCard}>
            <div className={styles.playerHead}>
              <div className={`${styles.avatar} ${styles.opponentAvatar}`}>{(opponent?.name || 'Rival').charAt(0).toUpperCase()}</div>
              <div>
                <p className={styles.playerLabel}>Opponent</p>
                <h2>{opponent?.name || 'Loading...'}</h2>
                <p className={styles.playerSub}>{opponent?.level || 'Opponent'} • {opponent?.xp ?? 0} XP</p>
              </div>
            </div>
            <div className={styles.score}>{opponentScore}</div>
            <div className={styles.scoreControls}>
              <button type="button" className={styles.scoreBtn} onClick={() => setOpponentScore((value) => Math.max(0, value - 1))}>
                <Minus size={16} />
                Remove point
              </button>
              <button type="button" className={styles.scoreBtnPrimary} onClick={() => setOpponentScore((value) => value + 1)}>
                <Plus size={16} />
                Add point
              </button>
            </div>
          </article>
        </section>

        {loading && !currentUser ? <div className={styles.loadingState}>Loading duel participants...</div> : null}
      </main>
    </div>
  );
}