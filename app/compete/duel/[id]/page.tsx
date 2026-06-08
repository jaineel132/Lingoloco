'use client';

import React, { useEffect, useMemo, useRef, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Sparkles, AlertCircle, Timer, Award } from 'lucide-react';
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

type DuelRoom = {
  id: string;
  player1_id: string;
  player2_id: string;
  language: string;
  status: 'waiting' | 'ready' | 'in_progress' | 'round_complete' | 'finished';
  current_round: number;
  player1_score: number;
  player2_score: number;
  current_challenge: string | null;
  player1_round_time: number | null;
  player2_round_time: number | null;
  round_winner_id: string | null;
  elo_change_p1: number | null;
  elo_change_p2: number | null;
  updated_at: string;
};

export default function DuelSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const unwrappedParams = use(params);

  // Users & Room State
  const [currentUser, setCurrentUser] = useState<ProfileRow | null>(null);
  const [opponent, setOpponent] = useState<ProfileRow | null>(null);
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  // Realtime Channels
  const dbChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Presence Tracking
  const [p1Present, setP1Present] = useState(false);
  const [p2Present, setP2Present] = useState(false);

  // Typing Game Client State
  const [inputVal, setInputVal] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [previousChallenges, setPreviousChallenges] = useState<string[]>([]);

  // Countdowns & Overlays
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showRoundOverlay, setShowRoundOverlay] = useState(false);
  const [roundOverlayTimer, setRoundOverlayTimer] = useState<number | null>(null);

  const languageName = useMemo(() => {
    return room?.language || opponent?.targetLanguage || currentUser?.targetLanguage || 'Spanish';
  }, [room?.language, opponent?.targetLanguage, currentUser?.targetLanguage]);

  // Load user and determine if URL parameter is a Room ID or Opponent ID
  useEffect(() => {
    let active = true;

    const initializeDuel = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const authUser = userData?.user;
        if (!authUser) {
          throw new Error('Please sign in to play duels.');
        }

        // Fetch current user's profile
        const { data: myProfile, error: myProfileError } = await supabase
          .from('profiles')
          .select('id,name,email,image,targetLanguage,level,xp')
          .eq('id', authUser.id)
          .maybeSingle();

        if (myProfileError) throw myProfileError;
        if (!myProfile) throw new Error('Your user profile was not found.');

        if (!active) return;
        setCurrentUser(myProfile);

        const targetId = unwrappedParams.id;

        // 1. Check if targetId is an existing room ID
        const { data: existingRoom, error: roomError } = await supabase
          .from('duel_rooms')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();

        if (existingRoom) {
          setRoom(existingRoom);

          // Fetch opponent profile details
          const opponentId = authUser.id === existingRoom.player1_id ? existingRoom.player2_id : existingRoom.player1_id;
          const { data: oppProfile, error: oppError } = await supabase
            .from('profiles')
            .select('id,name,email,image,targetLanguage,level,xp')
            .eq('id', opponentId)
            .maybeSingle();

          if (oppError) throw oppError;
          if (active) {
            setOpponent(oppProfile);
          }
        } else {
          // 2. targetId is likely an opponent user profile ID. Search for an active room.
          const { data: activeRooms, error: activeRoomsError } = await supabase
            .from('duel_rooms')
            .select('*')
            .or(`and(player1_id.eq.${authUser.id},player2_id.eq.${targetId}),and(player1_id.eq.${targetId},player2_id.eq.${authUser.id})`)
            .neq('status', 'finished')
            .order('updated_at', { ascending: false })
            .limit(1);

          if (activeRoomsError) throw activeRoomsError;

          if (activeRooms && activeRooms.length > 0) {
            router.replace(`/compete/duel/${activeRooms[0].id}`);
          } else {
            // Create a brand new duel room between current user and opponent
            const { data: newRoom, error: createError } = await supabase
              .from('duel_rooms')
              .insert({
                player1_id: authUser.id,
                player2_id: targetId,
                language: myProfile.targetLanguage || 'Spanish',
                status: 'waiting',
              })
              .select('*')
              .single();

            if (createError) throw createError;
            if (active) {
              router.replace(`/compete/duel/${newRoom.id}`);
            }
          }
        }
      } catch (err: any) {
        if (active) {
          setErrorText(err.message || 'Error initializing duel session.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void initializeDuel();

    return () => {
      active = false;
    };
  }, [supabase, unwrappedParams.id, router]);

  // Subscribe to changes on the specific Room record and setup Presence
  useEffect(() => {
    if (!room?.id || !currentUser) return;

    // A. Realtime Database Subscription
    const dbChannel = supabase
      .channel(`room-db:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duel_rooms', filter: `id=eq.${room.id}` },
        (payload: any) => {
          const updated = payload.new as DuelRoom;
          setRoom(updated);
        }
      )
      .subscribe();

    dbChannelRef.current = dbChannel;

    // B. Realtime Presence Subscription
    const presenceChannel = supabase.channel(`room-presence:${room.id}`, {
      config: { presence: { key: currentUser.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const keys = Object.keys(state);
        const p1InRoom = keys.includes(room.player1_id);
        const p2InRoom = keys.includes(room.player2_id);

        setP1Present(p1InRoom);
        setP2Present(p2InRoom);

        // If both players are present and room status is still waiting, update status to ready
        if (p1InRoom && p2InRoom && room.status === 'waiting') {
          void supabase
            .from('duel_rooms')
            .update({ status: 'ready', updated_at: new Date().toISOString() })
            .eq('id', room.id);
        }
      })
      .subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      if (dbChannelRef.current) {
        void supabase.removeChannel(dbChannelRef.current);
      }
      if (presenceChannelRef.current) {
        void supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [room?.id, currentUser, supabase]);

  // Handle Room State Transitions (Countdown, Round complete, Typing timers)
  useEffect(() => {
    if (!room) return;

    // 1. Ready state triggers 3-second countdown
    if (room.status === 'ready') {
      setCountdown(3);
      setInputVal('');
      setWpm(0);
      setCompleted(false);
      setShowRoundOverlay(false);
    }

    // 2. In progress state triggers typing start time
    if (room.status === 'in_progress') {
      setCountdown(null);
      setStartTime(Date.now());
      setInputVal('');
      setCompleted(false);
      setShowRoundOverlay(false);
      
      // Store previous challenges to prevent duplicates
      if (room.current_challenge && !previousChallenges.includes(room.current_challenge)) {
        setPreviousChallenges((prev) => [...prev, room.current_challenge!]);
      }
    }

    // 3. Round complete state triggers 3-second overlay showing round winner & times
    if (room.status === 'round_complete') {
      setShowRoundOverlay(true);
      setRoundOverlayTimer(3);
    }

    // 4. Finished state disables everything and resets countdowns
    if (room.status === 'finished') {
      setCountdown(null);
      setShowRoundOverlay(false);
    }
  }, [room?.status, room?.current_round, room?.current_challenge]);

  // Handle countdown tick (3...2...1...GO!)
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(null);
        // Host (Player 1) generates the challenge via API once countdown ends
        if (currentUser?.id === room?.player1_id && room?.id) {
          void generateNextChallenge();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, currentUser, room]);

  // Handle round overlay countdown (stays on screen 3 seconds before next round)
  useEffect(() => {
    if (roundOverlayTimer === null) return;

    if (roundOverlayTimer > 0) {
      const timer = setTimeout(() => setRoundOverlayTimer(roundOverlayTimer - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (roundOverlayTimer === 0) {
      setShowRoundOverlay(false);
      setRoundOverlayTimer(null);

      // Host (Player 1) triggers the ready state for the next round in the database
      if (currentUser?.id === room?.player1_id && room) {
        void supabase
          .from('duel_rooms')
          .update({
            status: 'ready',
            current_round: room.current_round + 1,
            player1_round_time: null,
            player2_round_time: null,
            round_winner_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', room.id);
      }
    }
  }, [roundOverlayTimer, currentUser, room, supabase]);

  // Typing Input handler
  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (completed || room?.status !== 'in_progress' || !room.current_challenge) return;

    const val = e.target.value;
    const challenge = room.current_challenge;

    // Limit typed length to challenge sentence length
    if (val.length > challenge.length) return;

    setInputVal(val);

    // Live WPM calculation
    if (startTime) {
      const elapsedMin = (Date.now() - startTime) / 1000 / 60;
      if (elapsedMin > 0.01) {
        setWpm(Math.round(val.length / 5 / elapsedMin));
      }
    }

    // Check if player fully and correctly finished the sentence
    if (val === challenge) {
      setCompleted(true);
      const timeMs = startTime ? Date.now() - startTime : 0;
      void submitRoundTime(timeMs);
    }
  };

  // Trigger Gemini generator endpoint
  const generateNextChallenge = async () => {
    if (!room) return;
    try {
      const response = await fetch('/api/duel/generate-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          language: room.language,
          round: room.current_round,
          previousChallenges,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to generate challenge');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Error generating challenge');
    }
  };

  // Submit completion time
  const submitRoundTime = async (timeMs: number) => {
    if (!room || !currentUser) return;
    try {
      const response = await fetch('/api/duel/submit-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playerId: currentUser.id,
          timeMs,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to submit round time');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Error saving typing time');
    }
  };

  // Character coloring display algorithm
  const renderChallengeText = () => {
    if (!room?.current_challenge) return null;
    
    const challenge = room.current_challenge;
    return challenge.split('').map((char, index) => {
      let charClass = styles.charNotTyped;
      if (index < inputVal.length) {
        charClass = inputVal[index] === char ? styles.charCorrect : styles.charIncorrect;
      }
      return (
        <span key={index} className={charClass}>
          {char}
        </span>
      );
    });
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Initializing duel room session...</p>
        </div>
      </div>
    );
  }

  if (errorText) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.errorCard}>
          <AlertCircle className={styles.errorIcon} size={48} />
          <h2>Duel Room Error</h2>
          <p>{errorText}</p>
          <Link href="/compete" className={styles.backBtn}>
            <ArrowLeft size={16} /> Back to Compete
          </Link>
        </div>
      </div>
    );
  }

  if (!room || !currentUser) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.errorCard}>
          <AlertCircle className={styles.errorIcon} size={48} />
          <h2>Room Not Available</h2>
          <p>This duel room session could not be established.</p>
          <Link href="/compete" className={styles.backBtn}>
            <ArrowLeft size={16} /> Back to Compete
          </Link>
        </div>
      </div>
    );
  }

  const isHost = currentUser.id === room.player1_id;
  const isP1Self = currentUser.id === room.player1_id;
  const myScore = isP1Self ? room.player1_score : room.player2_score;
  const oppScore = isP1Self ? room.player2_score : room.player1_score;

  // Determine Overall Match Result (for finished screen)
  const isFinished = room.status === 'finished';
  const matchWinnerId = room.player1_score > room.player2_score ? room.player1_id : room.player2_id;
  const iWonMatch = currentUser.id === matchWinnerId;
  const myEloChange = isP1Self ? room.elo_change_p1 : room.elo_change_p2;
  const oppEloChange = isP1Self ? room.elo_change_p2 : room.elo_change_p1;

  // Formatting utility
  const formatTime = (ms: number | null) => {
    if (ms === null) return 'DNF';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.glowA} />
      <div className={styles.glowB} />

      {/* Top Navbar */}
      <div className={styles.topbar}>
        <Link href="/compete" className={styles.backBtn}>
          <ArrowLeft size={20} />
          Back
        </Link>
        <div className={styles.topbarMeta}>
          <span className={styles.badge}>
            <Sparkles size={14} /> Real-Time Typing Duel
          </span>
          <span className={styles.language}>{languageName}</span>
        </div>
      </div>

      <main className={styles.shell}>
        {/* Header Hero */}
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Language Speed Arena</p>
            <h1>Typing Duel</h1>
            <p className={styles.heroCopy}>
              Type the sentence exactly as shown as fast as possible. First to finish wins the round. 5 rounds total!
            </p>
          </div>
          <div className={styles.heroStat}>
            <Timer size={20} />
            <span>Round {Math.min(5, room.current_round)} of 5</span>
          </div>
        </section>

        {/* Players Cards Grid */}
        <section className={styles.arena}>
          {/* Player 1 Card (You/Opponent depending on who loaded) */}
          <article className={styles.playerCard}>
            <div className={styles.playerHead}>
              <div className={styles.avatar}>{currentUser.name?.charAt(0).toUpperCase() || 'Y'}</div>
              <div>
                <p className={styles.playerLabel}>You</p>
                <h2>{currentUser.name || 'Learner'}</h2>
                <p className={styles.playerSub}>
                  {currentUser.level || 'Beginner'} • {currentUser.xp ?? 0} XP
                </p>
              </div>
            </div>
            <div className={styles.score}>{myScore}</div>
            <div className={styles.presenceIndicator}>
              <span className={styles.onlineDot} /> Online
            </div>
          </article>

          {/* VS Center Pillar */}
          <div className={styles.vsColumn}>
            <div className={styles.vsPill}>VS</div>
            <p className={styles.vsNote}>First to complete 3 rounds wins.</p>
          </div>

          {/* Player 2 Card (Rival) */}
          <article className={styles.playerCard}>
            <div className={styles.playerHead}>
              <div className={`${styles.avatar} ${styles.opponentAvatar}`}>
                {opponent?.name?.charAt(0).toUpperCase() || 'R'}
              </div>
              <div>
                <p className={styles.playerLabel}>Opponent</p>
                <h2>{opponent?.name || 'Rival'}</h2>
                <p className={styles.playerSub}>
                  {opponent?.level || 'Beginner'} • {opponent?.xp ?? 0} XP
                </p>
              </div>
            </div>
            <div className={styles.score}>{oppScore}</div>
            <div className={styles.presenceIndicator}>
              {p2Present ? (
                <>
                  <span className={styles.onlineDot} /> Joined Room
                </>
              ) : (
                <>
                  <span className={styles.offlineDot} /> Waiting to join...
                </>
              )}
            </div>
          </article>
        </section>

        {/* Game Arena Board */}
        {!isFinished && (
          <section className={styles.typingSection}>
            {/* Waiting State */}
            {room.status === 'waiting' && (
              <div className={styles.waitingOverlay}>
                <div className={styles.spinner} />
                <h3>Waiting for opponent to connect...</h3>
                <p className={styles.waitingSubText}>
                  Provide them with your profile page or invite them on the Matchmaking screen.
                </p>
              </div>
            )}

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className={styles.countdownOverlay}>
                <div className={styles.countdownNumber}>
                  {countdown === 0 ? 'GO!' : countdown}
                </div>
              </div>
            )}

            {/* Main Typing Interface */}
            {room.status === 'in_progress' && (
              <div className={styles.typingArea}>
                <div className={styles.roundInfoLine}>
                  <span>Round {room.current_round}</span>
                  <div className={styles.liveStatBadge}>WPM: {wpm}</div>
                </div>

                <div className={styles.challengeBox}>
                  {renderChallengeText()}
                </div>

                <input
                  type="text"
                  className={styles.typingInput}
                  placeholder="Type the sentence here..."
                  value={inputVal}
                  onChange={handleTypingChange}
                  disabled={completed}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />

                {completed && (
                  <div className={styles.completedBadge}>
                    <Award size={16} /> Completed! Waiting for round submission to process...
                  </div>
                )}
              </div>
            )}

            {/* Round Completed Intermediate Overlay */}
            {showRoundOverlay && (
              <div className={styles.roundCompleteOverlay}>
                <div className={styles.roundCompleteCard}>
                  <Trophy size={48} className={styles.roundCompleteIcon} />
                  <h2>Round {room.current_round} Complete!</h2>
                  
                  <div className={styles.roundWinnerAnnouncement}>
                    {room.round_winner_id === currentUser.id ? (
                      <span className={styles.winnerColor}>You won this round!</span>
                    ) : (
                      <span className={styles.loserColor}>{opponent?.name || 'Rival'} won this round!</span>
                    )}
                  </div>

                  <div className={styles.resultsGrid}>
                    <div className={styles.resultItem}>
                      <strong>Your Time</strong>
                      <span>{formatTime(isP1Self ? room.player1_round_time : room.player2_round_time)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <strong>Opponent Time</strong>
                      <span>{formatTime(isP1Self ? room.player2_round_time : room.player1_round_time)}</span>
                    </div>
                  </div>

                  <p className={styles.nextRoundCountdown}>
                    Next round starting in {roundOverlayTimer}s...
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Final Scoring & Elo Board (Match Finished) */}
        {isFinished && (
          <section className={styles.finishedSection}>
            <div className={styles.finishedCard}>
              <Trophy size={64} className={styles.finishedTrophy} />
              
              {iWonMatch ? (
                <div className={styles.finishedMessage}>
                  <Sparkles size={24} className={styles.sparkleIcon} />
                  <h2>Victory!</h2>
                  <p>You defeated {opponent?.name || 'your rival'}!</p>
                </div>
              ) : (
                <div className={styles.finishedMessage}>
                  <h2>Defeat</h2>
                  <p>{opponent?.name || 'Your rival'} defeated you!</p>
                </div>
              )}

              <div className={styles.finalScoreDisplay}>
                <span>{myScore}</span>
                <span className={styles.finalScoreSeparator}>-</span>
                <span>{oppScore}</span>
              </div>

              <div className={styles.eloChangesBox}>
                <h3>Elo Rating Updates</h3>
                <div className={styles.eloChangesGrid}>
                  <div className={styles.eloPlayerRow}>
                    <span>You</span>
                    <strong className={myEloChange && myEloChange >= 0 ? styles.eloPlus : styles.eloMinus}>
                      {myEloChange && myEloChange >= 0 ? `+${myEloChange}` : myEloChange} Elo
                    </strong>
                  </div>
                  <div className={styles.eloPlayerRow}>
                    <span>{opponent?.name || 'Rival'}</span>
                    <strong className={oppEloChange && oppEloChange >= 0 ? styles.eloPlus : styles.eloMinus}>
                      {oppEloChange && oppEloChange >= 0 ? `+${oppEloChange}` : oppEloChange} Elo
                    </strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={styles.finishArenaBtn}
                onClick={() => router.push('/compete')}
              >
                Return to Compete Arena
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}