"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';
import { Shield, Zap, X, Check, ArrowLeft, Radar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../lib/supabase/clientFetch';
import { createBrowserClient } from '@/lib/supabase/browser';

type RivalCard = {
  id: string;
  name: string;
  email: string;
  bio: string;
  rank: string;
  xp: number;
  lang: string;
  avatar: string;
  image: string;
};

type DuelNotification = {
  id: string;
  userId?: string;
  senderEmail: string;
  senderName: string;
  senderImage: string;
  senderTargetLanguage: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
};

type DuelRoomPayload = {
  rivals: RivalCard[];
  notifications: DuelNotification[];
  language?: string;
};

const CARD_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#EF476F', '#118AB2', '#06D6A0'];

export default function MatchPage() {
  const router = useRouter();
  const { accessToken, user } = useSupabaseAuth();
  const [cards, setCards] = useState<RivalCard[]>([]);
  const [notifications, setNotifications] = useState<DuelNotification[]>([]);
  const [duelLanguage, setDuelLanguage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sendingCardId, setSendingCardId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const supabase = createBrowserClient();

  const pendingRequests = useMemo(
    () => notifications.filter((item) => item.status === 'pending'),
    [notifications]
  );

  const handleRemove = (id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
  };

  const loadDuelData = async () => {
    setIsLoading(true);
    try {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/compete/duels', withSupabaseAuthHeaders(accessToken, { cache: 'no-store' }));
      const payload = (await response.json()) as { success?: boolean; data?: DuelRoomPayload; error?: string };

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load duel data.');
      }

      setCards(Array.isArray(payload?.data?.rivals) ? payload.data.rivals : []);
      setNotifications(Array.isArray(payload?.data?.notifications) ? payload.data.notifications : []);
      setDuelLanguage(String(payload?.data?.language || '').toUpperCase());
      setStatusText('');
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to load duel data.');
      setCards([]);
      setNotifications([]);
      setDuelLanguage('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDuelData();
  }, [accessToken]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`duel-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'duel_notifications',
          filter: `userId=eq.${user.id}`,
        },
        () => {
          void loadDuelData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, user?.id]);

  const sendChallenge = async (card: RivalCard) => {
    if (sendingCardId) {
      return;
    }

    setSendingCardId(card.id);
    setStatusText(`Sending challenge to ${card.name}...`);

    try {
      const response = await fetch('/api/compete/duels', withSupabaseAuthHeaders(accessToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'send', targetEmail: card.email }),
      }));

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Could not send challenge.');
      }

      handleRemove(card.id);
      setStatusText(payload?.message || `Challenge sent to ${card.name}.`);
    } catch (error: any) {
      setStatusText(error?.message || `Failed to send challenge to ${card.name}.`);
    } finally {
      setSendingCardId(null);
    }
  };

  const respondToNotification = async (notificationId: string, action: 'accept' | 'decline') => {
    setStatusText(action === 'accept' ? 'Accepting challenge...' : 'Declining challenge...');

    try {
      const response = await fetch('/api/compete/duels', withSupabaseAuthHeaders(accessToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, notificationId }),
      }));

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to update request.');
      }

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                status: action === 'accept' ? 'accepted' : 'declined',
                respondedAt: new Date().toISOString(),
              }
            : item
        )
      );
      setStatusText(payload?.message || 'Request updated.');

      if (action === 'accept' && payload.roomId) {
        router.push(`/compete/duel/${payload.roomId}`);
      }
    } catch (error: any) {
      setStatusText(error?.message || 'Failed to update request.');
    }
  };

  const handleRightSwipe = (card: RivalCard) => {
    void sendChallenge(card);
  };

  const openDuelSession = (card: RivalCard) => {
    const searchParams = new URLSearchParams({
      name: card.name,
      email: card.email,
      rank: card.rank,
      xp: String(card.xp),
      lang: card.lang,
      avatar: card.avatar,
      image: card.image || '',
    });

    router.push(`/compete/duel/${card.id}?${searchParams.toString()}`);
  };

  const handleLeftSwipe = (cardId: string) => {
    handleRemove(cardId);
    setStatusText('Skipped this rival.');
  };

  const activeCard = cards.length > 0 ? cards[cards.length - 1] : null;

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.header}>
        <Link href="/compete" className={styles.backBtn}>
          <ArrowLeft size={24} />
        </Link>
        <div className={styles.titles}>
          <h1 className={styles.title}>Find a Rival</h1>
          <p className={styles.subtitle}>Swipe right to challenge</p>
        </div>
        <div style={{ width: 50, flexShrink: 0 }} /> {/* placeholder for centering */}
      </div>

      <div className={styles.roomHeader}>
        <div>
          <h2 className={styles.roomTitle}>Duel Room</h2>
          <p className={styles.roomSubtitle}>Current players available for one-on-one requests</p>
        </div>
        <div className={styles.roomLanguageBadge}>{duelLanguage || 'ALL LANGUAGES'}</div>
      </div>

      <div className={styles.container}>
        {/* Left Sidebar Layout */}
        <div className={styles.leftSidebar}>
          <div className={styles.sidebarCard}>
            <h3>Your Stats</h3>
            <p className={styles.sidebarSub}>Current Season</p>
            <div className={styles.statRow}><span>Win Rate</span><strong>68%</strong></div>
            <div className={styles.statRow}><span>Matches</span><strong>124</strong></div>
            <div className={styles.statRow}><span>Current Streak</span><strong>🔥 5</strong></div>
          </div>
        </div>

        <div className={styles.mainContent}>
          {statusText ? <div className={styles.statusBar}>{statusText}</div> : null}

          {!isLoading && cards.length > 0 && (
            <div className={styles.duelRoomList}>
              {cards.map((card) => (
                <div key={card.id} className={styles.duelRoomRow}>
                  <div className={styles.duelRoomPlayer}>
                    <div className={styles.duelRoomAvatar}>{card.avatar}</div>
                    <div>
                      <div className={styles.duelRoomName}>{card.name}</div>
                      <div className={styles.duelRoomMeta}>{card.rank} • {card.xp.toLocaleString()} XP</div>
                    </div>
                  </div>
                  <div className={styles.duelRoomLang}>{card.lang}</div>
                  <button type="button" className={styles.duelRoomSendBtn} onClick={() => handleRightSwipe(card)} disabled={sendingCardId === card.id}>
                    {sendingCardId === card.id ? 'Sending...' : 'Send Duel Request'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.cardsContainer}>
            <AnimatePresence>
              {cards.map((card, index) => (
                <MatchCard 
                  key={card.id} 
                  card={card} 
                  active={index === cards.length - 1} 
                  color={CARD_COLORS[index % CARD_COLORS.length]}
                  isBusy={sendingCardId === card.id}
                  onLeftSwipe={() => handleLeftSwipe(card.id)}
                  onRightSwipe={() => handleRightSwipe(card)}
                />
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className={styles.loadingState}>
                <p>Loading rivals and duel requests...</p>
              </div>
            )}
            
            {!isLoading && cards.length === 0 && (
              <div className={styles.noMoreCards}>
                <div className={styles.pulseIcon}>
                  <Radar size={64} color="#22c55e" />
                </div>
                <h2>No rivals in this duel room</h2>
                <p>Only learners with the same target language appear here. Ask them to set the same language and sign in, then refresh.</p>
                <button className={styles.refreshBtn} onClick={() => void loadDuelData()}>Refresh Search</button>
              </div>
            )}
          </div>
          
          {activeCard && (
            <div className={styles.controls}>
              <div className={styles.btnReject} onClick={() => handleLeftSwipe(activeCard.id)}>
                <X size={32} />
              </div>
              <button type="button" className={styles.btnDuel} onClick={() => openDuelSession(activeCard)}>
                DUEL
              </button>
              <div className={styles.btnAccept} onClick={() => handleRightSwipe(activeCard)}>
                <Check size={32} />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Layout */}
        <div className={styles.rightSidebar}>
          <div className={`${styles.sidebarCard} ${styles.notificationsCard}`}>
            <h3>Duel Notifications</h3>
            <p className={styles.sidebarSub}>Requests sent to you</p>
            {pendingRequests.length === 0 ? (
              <p className={styles.emptyNote}>No pending duel requests right now.</p>
            ) : (
              <ul className={styles.notificationList}>
                {pendingRequests.map((item) => (
                  <li key={item.id}>
                    <div className={styles.notificationHead}>
                      <strong>{item.senderName}</strong>
                      <span>{item.senderTargetLanguage || 'Any language'}</span>
                    </div>
                    <div className={styles.notificationActions}>
                      <button type="button" className={styles.acceptMini} onClick={() => void respondToNotification(item.id, 'accept')}>
                        Accept
                      </button>
                      <button type="button" className={styles.rejectMini} onClick={() => void respondToNotification(item.id, 'decline')}>
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.sidebarCard}>
            <h3>Top Rivals</h3>
            <p className={styles.sidebarSub}>Your highest win rates</p>
            <ul className={styles.rivalList}>
              <li>
                <div className={styles.avatarMini} style={{background: '#FF6B6B'}}>J</div>
                <div className={styles.rivalInfo}>
                  <strong>Jake_M</strong>
                  <span>8 Wins - 2 Losses</span>
                </div>
              </li>
              <li>
                <div className={styles.avatarMini} style={{background: '#4ECDC4'}}>L</div>
                <div className={styles.rivalInfo}>
                  <strong>Lina99</strong>
                  <span>5 Wins - 4 Losses</span>
                </div>
              </li>
              <li>
                <div className={styles.avatarMini} style={{background: '#FFE66D'}}>T</div>
                <div className={styles.rivalInfo}>
                  <strong>Tom_FR</strong>
                  <span>12 Wins - 10 Losses</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  card,
  active,
  color,
  isBusy,
  onLeftSwipe,
  onRightSwipe,
}: {
  card: RivalCard;
  active: boolean;
  color: string;
  isBusy: boolean;
  onLeftSwipe: () => void;
  onRightSwipe: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const nopeOpacity = useTransform(x, [-100, -20, 0], [1, 0, 0]);
  const duelOpacity = useTransform(x, [0, 20, 100], [0, 0, 1]);
  
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    if (info.offset.x > 100) {
      onRightSwipe();
      return;
    }

    if (info.offset.x < -100) {
      onLeftSwipe();
    }
  };

  return (
    <motion.div
      className={styles.card}
      style={{ x, rotate, gridArea: "1 / 1" }}
      drag={active && !isBusy ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={{ scale: active ? 1 : 0.95, y: active ? 0 : 20, zIndex: active ? 10 : 1 }}
      exit={{ x: x.get() > 0 ? 300 : -300, opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className={styles.cardCover} style={{ backgroundColor: color }}>
        {card.image ? (
          <img src={card.image} alt={card.name} className={styles.avatarImage} />
        ) : (
          <div className={styles.avatarBig}>{card.avatar}</div>
        )}
        
        {active && (
         <div className={styles.swipeHints}>
           <motion.div className={styles.hintLeft} style={{ opacity: nopeOpacity }}>NOPE</motion.div>
           <motion.div className={styles.hintRight} style={{ opacity: duelOpacity }}>DUEL</motion.div>
         </div>
      )}
      </div>
      
      <div className={styles.cardDetails}>
        <h2>{card.name}</h2>
        <p className={styles.cardBio}>{card.bio}</p>
        <div className={styles.stats}>
          <div className={styles.statBox}>
            <Shield size={18} className={styles.statIcon} />
            <span>{card.rank}</span>
          </div>
          <div className={styles.statBox}>
            <Zap size={18} className={styles.statIcon} style={{ color: '#F59E0B'}} />
            <span>{card.xp.toLocaleString()} XP</span>
          </div>
        </div>
        <div className={styles.langBadge}>{card.lang}</div>
        {isBusy ? <p className={styles.cardBusy}>Sending challenge...</p> : null}
      </div>
    </motion.div>
  );
}
