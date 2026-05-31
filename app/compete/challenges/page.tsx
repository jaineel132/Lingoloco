"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { useSupabaseAuth } from '../../../components/AuthProvider';
import { withSupabaseAuthHeaders } from '../../../lib/supabase/clientFetch';
import styles from './page.module.css';
import { COMPETE_SQUADS } from '../../../lib/competeSquads';

type Squad = {
  id: number;
  name: string;
  lang: string;
  members: number;
  maxMembers: number;
  score: string;
  icon: string;
  joined: boolean;
  canJoin: boolean;
};

type ChallengesApiResponse = {
  success?: boolean;
  data?: {
    squads?: Squad[];
    joinedSquadId?: number | null;
  };
  error?: string;
  message?: string;
};

export default function ChallengesPage() {
  const { user, signInWithGoogle, accessToken } = useSupabaseAuth();
  const localStorageKey = 'lingoloco-compete-squad';
  const [squads, setSquads] = useState<Squad[]>(
    COMPETE_SQUADS.map((squad) => ({
      id: squad.id,
      name: squad.name,
      lang: squad.lang,
      members: squad.baseMembers,
      maxMembers: squad.maxMembers,
      score: squad.score,
      icon: squad.icon,
      joined: false,
      canJoin: squad.baseMembers < squad.maxMembers,
    }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [joiningSquadId, setJoiningSquadId] = useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string>('');
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [panelStatus, setPanelStatus] = useState<string>('');

  const getFallbackSquads = () => COMPETE_SQUADS.map((squad) => ({
    id: squad.id,
    name: squad.name,
    lang: squad.lang,
    members: squad.baseMembers,
    maxMembers: squad.maxMembers,
    score: squad.score,
    icon: squad.icon,
    joined: false,
    canJoin: squad.baseMembers < squad.maxMembers,
  }));

  const readLocalJoinedSquadId = () => {
    if (typeof window === 'undefined') {
      return null;
    }

    const value = window.localStorage.getItem(localStorageKey);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const persistLocalJoinedSquad = (squadId: number | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (squadId === null) {
      window.localStorage.removeItem(localStorageKey);
      return;
    }

    window.localStorage.setItem(localStorageKey, String(squadId));
  };

  const applyJoinedSquad = (squadId: number, sourceSquads?: Squad[]) => {
    const baseList = sourceSquads || squads;
    const nextSquads = baseList.map((squad) => ({
      ...squad,
      joined: squad.id === squadId,
      canJoin: squad.id === squadId ? true : squad.canJoin,
    }));

    setSquads(nextSquads);
    persistLocalJoinedSquad(squadId);

    const joinedSquad = nextSquads.find((squad) => squad.id === squadId) || null;
    if (joinedSquad) {
      setSelectedSquad(joinedSquad);
    }
  };

  const fetchSquads = async () => {
    try {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1200);
      const response = await fetch('/api/compete/challenges', withSupabaseAuthHeaders(accessToken, { cache: 'no-store', signal: controller.signal }));
      window.clearTimeout(timeout);
      const json = (await response.json()) as ChallengesApiResponse;

      if (json.success && json.data?.squads) {
        const joinedSquadId = json.data.joinedSquadId ?? readLocalJoinedSquadId();
        setSquads(json.data.squads.map((squad) => ({
          ...squad,
          joined: joinedSquadId === squad.id || squad.joined,
          canJoin: joinedSquadId === squad.id ? true : squad.canJoin,
        })));
      } else {
        setSquads((current) => current.length ? current : getFallbackSquads());
      }
    } catch (error) {
      console.error('Failed to fetch squads:', error);
      setSquads((current) => current.length ? current : getFallbackSquads());
      const localJoinedSquadId = readLocalJoinedSquadId();
      if (localJoinedSquadId) {
        setSquads((current) => current.map((squad) => ({
          ...squad,
          joined: squad.id === localJoinedSquadId,
          canJoin: squad.id === localJoinedSquadId ? true : squad.canJoin,
        })));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const localJoinedSquadId = readLocalJoinedSquadId();
    if (localJoinedSquadId) {
      setSquads((current) => current.map((squad) => ({
        ...squad,
        joined: squad.id === localJoinedSquadId,
        canJoin: squad.id === localJoinedSquadId ? true : squad.canJoin,
      })));
    }

    fetchSquads();
  }, [accessToken]);

  const handleJoinSquad = async (squadId: number) => {
    if (!user) {
      await signInWithGoogle('/compete/challenges');
      return;
    }

    setJoiningSquadId(squadId);
    setBannerMessage('');
    setPanelStatus('Joining squad...');

    applyJoinedSquad(squadId);
    setBannerMessage('Squad joined. Syncing with your account...');

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2000);
      const response = await fetch('/api/compete/challenges', withSupabaseAuthHeaders(accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId }),
        signal: controller.signal,
      }));
      window.clearTimeout(timeout);
      const json = (await response.json()) as ChallengesApiResponse;

      if (json.success && json.data?.squads) {
        setSquads(json.data.squads);
        setBannerMessage(json.message || 'Squad joined successfully.');
        setPanelStatus(json.message || 'Joined successfully.');
        setTimeout(() => {
          setSelectedSquad(null);
          fetchSquads().catch((error) => {
            console.error('Failed to refresh squads after join:', error);
          });
        }, 350);
      } else {
        setBannerMessage(json.error || 'Joined locally, but cloud sync failed.');
        setPanelStatus(json.error || 'Joined locally, but cloud sync failed.');
      }
    } catch (error) {
      console.error('Join squad failed:', error);
      setBannerMessage('Joined locally. Supabase sync is temporarily unavailable right now.');
      setPanelStatus('Joined locally. Cloud sync is temporarily unavailable.');
    } finally {
      setJoiningSquadId(null);
    }
  };

  const openSquadPanel = (squad: Squad) => {
    setSelectedSquad(squad);
    setPanelStatus(squad.joined ? 'This squad is already active on your account.' : 'Tap Join Now to activate this squad.');
    setBannerMessage('');
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.header}>
        <Link href="/compete" className={styles.backBtn}>
          <ArrowLeft size={24} />
        </Link>
        <div className={styles.titles}>
          <h1 className={styles.title}>Group Challenges</h1>
          <p className={styles.subtitle}>Join a squad and compete globally</p>
        </div>
        <div style={{ width: 48, flexShrink: 0 }} /> {/* placeholder for centering */}
      </div>

      {bannerMessage && (
        <div className={styles.statusBanner}>{bannerMessage}</div>
      )}

      <div className={styles.contentGrid}>
        
        {/* Global Challenge */}
        <div className={styles.globalChallenge}>
          <div className={styles.globalInfo}>
            <h2>Weekend Wordathon</h2>
            <p>The community is trying to translate 1,000,000 words this weekend! Join a squad to contribute to the global goal.</p>
            <div className={styles.progressBarContainer}>
              <div className={styles.progressBar} style={{ width: '68%' }}></div>
            </div>
            <span className={styles.progressText}>680,241 / 1,000,000 words</span>
          </div>
        </div>

        {/* Squads List */}
        <div className={styles.squadSection}>
          <h2 className={styles.sectionTitle}>Active Squads</h2>
          <div className={styles.squadGrid}>
            {squads.map(squad => (
              <div key={squad.id} className={styles.squadCard}>
                <div className={styles.squadHeader}>
                  <div className={styles.squadIcon}>{squad.icon}</div>
                  <div>
                    <h3>{squad.name}</h3>
                    <span className={styles.squadLang}>{squad.lang}</span>
                  </div>
                </div>
                
                <div className={styles.squadStats}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{squad.members} / {squad.maxMembers}</span>
                    <span className={styles.statLabel}>Members</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{squad.score}</span>
                    <span className={styles.statLabel}>Weekly XP</span>
                  </div>
                </div>

                <button
                  className={`${styles.joinBtn} ${!squad.canJoin ? styles.full : ''} ${squad.joined ? styles.joined : ''}`}
                  onClick={() => openSquadPanel(squad)}
                  disabled={joiningSquadId === squad.id || (!squad.canJoin && !squad.joined)}
                >
                  {squad.joined ? 'Joined' : squad.canJoin ? 'Join Squad' : 'Squad Full'}
                </button>
              </div>
            ))}
            {isLoading && <div className={styles.loadingState}>Refreshing squad status...</div>}
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebarSection}>
          <div className={styles.createCard}>
            <div className={styles.createIcon}>
              <Plus size={32} />
            </div>
            <h3>Form your own</h3>
            <p>Gather your friends and start a new study squad to climb the ranks.</p>
            <button className={styles.createBtn}>Create Squad</button>
          </div>

          <div className={styles.leaderboardCard}>
            <h3>Top Squads This Week</h3>
            <ul className={styles.leaderboardList}>
              <li className={styles.leaderboardItem}>
                <span className={`${styles.rank} ${styles.rank1}`}>1</span>
                <span className={styles.squadTitle}>Polyglot Pioneers</span>
                <span className={styles.squadScore}>124k</span>
              </li>
              <li className={styles.leaderboardItem}>
                <span className={`${styles.rank} ${styles.rank2}`}>2</span>
                <span className={styles.squadTitle}>Spanish Inq.</span>
                <span className={styles.squadScore}>89k</span>
              </li>
              <li className={styles.leaderboardItem}>
                <span className={`${styles.rank} ${styles.rank3}`}>3</span>
                <span className={styles.squadTitle}>Mandarin Masters</span>
                <span className={styles.squadScore}>76k</span>
              </li>
              <li className={styles.leaderboardItem}>
                <span className={styles.rank}>4</span>
                <span className={styles.squadTitle}>Kanji Kings</span>
                <span className={styles.squadScore}>64k</span>
              </li>
              <li className={styles.leaderboardItem}>
                <span className={styles.rank}>5</span>
                <span className={styles.squadTitle}>Fluency Fanatics</span>
                <span className={styles.squadScore}>58k</span>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {selectedSquad && (
        <div className={styles.joinOverlay} onClick={() => setSelectedSquad(null)}>
          <div className={styles.joinPanel} onClick={(event) => event.stopPropagation()}>
            <button className={styles.joinCloseBtn} onClick={() => setSelectedSquad(null)}>×</button>
            <div className={styles.joinPanelHeader}>
              <div className={styles.joinPanelIcon}>{selectedSquad.icon}</div>
              <div>
                <h3>{selectedSquad.name}</h3>
                <p>{selectedSquad.lang}</p>
              </div>
            </div>

            <div className={styles.joinPanelStats}>
              <div>
                <span>Members</span>
                <strong>{selectedSquad.members} / {selectedSquad.maxMembers}</strong>
              </div>
              <div>
                <span>Weekly XP</span>
                <strong>{selectedSquad.score}</strong>
              </div>
            </div>

            <p className={styles.joinPanelCopy}>
              {selectedSquad.joined
                ? 'You are already in this squad. Your progress is being tracked here.'
                : selectedSquad.canJoin
                  ? 'Tap Join Now to make this your active squad and start tracking your progress.'
                  : 'This squad is full right now. Try another active squad.'}
            </p>

            {panelStatus && <div className={styles.joinPanelStatus}>{panelStatus}</div>}

            <div className={styles.joinPanelActions}>
              <button className={styles.cancelBtn} onClick={() => setSelectedSquad(null)}>Close</button>
              {!selectedSquad.joined && selectedSquad.canJoin && (
                <button
                  className={styles.confirmJoinBtn}
                  onClick={() => handleJoinSquad(selectedSquad.id)}
                  disabled={joiningSquadId === selectedSquad.id}
                >
                  {joiningSquadId === selectedSquad.id ? 'Joining...' : 'Join Now'}
                </button>
              )}
              {selectedSquad.joined && (
                <button className={styles.confirmJoinBtn} onClick={() => setSelectedSquad(null)}>
                  Keep Squad
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
