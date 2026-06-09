"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from "./page.module.css";
import { createBrowserClient } from '@/lib/supabase/browser';

export default function CompetePage() {
  const [globalTop, setGlobalTop] = useState<any[] | null>(null);
  const [friendsTop, setFriendsTop] = useState<any[] | null>(null);
  const [myRanking, setMyRanking] = useState<any | null>(null);
  const [tournamentEndsAt, setTournamentEndsAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('00:00:00');
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient();

  function formatCountdown(endsAt: string | null) {
    if (!endsAt) return '00:00:00';

    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return '00:00:00';

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
  }

  async function fetchLeaderboards() {
    setLoading(true);
    try {
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('ends_at')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      setTournamentEndsAt(tournamentData?.ends_at ?? null);

      const gRes = await fetch('/api/compete/leaderboard?type=global');
      const gData = await gRes.json();
      setGlobalTop(Array.isArray(gData) ? gData : []);

      const fRes = await fetch('/api/compete/leaderboard?type=friends');
      const fData = await fRes.json();
      setFriendsTop(Array.isArray(fData) ? fData : []);

      // fetch current user's ranking
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user ?? null;
      if (user) {
        const { data: myRows } = await supabase
          .from('user_rankings')
          .select('*')
          .eq('user_id', user.id)
          .limit(1);

        setMyRanking(myRows && myRows.length ? myRows[0] : null);
      } else {
        setMyRanking(null);
      }
    } catch (e) {
      console.error('Failed to fetch leaderboards', e);
      setGlobalTop([]);
      setFriendsTop([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeaderboards();

    // realtime subscription to user_rankings updates
    const channel = supabase
      .channel('public:user_rankings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_rankings' }, () => {
        fetchLeaderboards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCountdown(formatCountdown(tournamentEndsAt));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(tournamentEndsAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [tournamentEndsAt]);

  const leagueDisplay = myRanking && myRanking.league
    ? String(myRanking.league).charAt(0).toUpperCase() + String(myRanking.league).slice(1)
    : '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Social & Compete</h1>
        <p className={styles.subtitle}>Motivate yourself and others. Show the world what you're capable of.</p>
      </div>

      <div className={styles.grid}>
        {/* League Card */}
        <div className={`${styles.card} ${styles.leagueCard}`}>
          <div className={styles.leagueInfo}>
            <h2>{leagueDisplay ? `${leagueDisplay} League` : 'League'}</h2>
            <p>Top 20% promoted this week. You are in the promotion zone!</p>
          </div>
          <div className={styles.leagueBadge}>
            {leagueDisplay === 'Diamond' ? '💎' : leagueDisplay === 'Platinum' ? '🔷' : '🏅'}
          </div>
        </div>

        {/* 1v1 Duels */}
        <div className={`${styles.card} ${styles.duelCard}`}>
          <div className={styles.actionCardInner}>
            <div className={styles.actionIcon}>⚔️</div>
            <h3>Real-Time 1v1 Duels</h3>
            <p>Challenge other learners in live vocabulary and translation matches.</p>
            <Link href="/compete/match">
              <button className={styles.actionBtn}>Find Match</button>
            </Link>
          </div>
        </div>

        {/* Group Challenges */}
        <div className={`${styles.card} ${styles.groupCard}`}>
          <div className={styles.actionCardInner}>
            <div className={styles.actionIcon}>🛡️</div>
            <h3>Group Challenges</h3>
            <p>Form study groups with friends and compete as a team.</p>
            <Link href="/compete/challenges">
              <button className={styles.actionBtn}>Create Squad</button>
            </Link>
          </div>
        </div>

        {/* Tournaments */}
        <div className={`${styles.card} ${styles.tournamentCard}`}>
          <div>
            <h3>Weekend Sprint Tournament</h3>
            <p style={{ opacity: 0.8 }}>Exclusive rewards for top 100 participants.</p>
          </div>
          <div className={styles.tournamentTimer}>
            Ends in {countdown}
          </div>
        </div>

        {/* Global Leaderboard */}
        <div className={`${styles.card} ${styles.leaderboardCard}`}>
          <div className={styles.leaderboardHeader}>
            <h3>Global Top 100</h3>
            <span style={{color: '#888', fontSize: '0.9rem'}}>Spanish</span>
          </div>
          <ul className={styles.leaderboardList}>
            {loading && Array.from({ length: 5 }).map((_, idx) => (
              <li key={`global-skeleton-${idx}`} className={styles.leaderboardItem}>
                <span className={`${styles.rank} ${idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : idx === 2 ? styles.rank3 : ''}`} style={{ background: '#e5e7eb', color: 'transparent' }}>0</span>
                <div className={styles.avatar} style={{ background: '#e5e7eb', color: 'transparent' }}>A</div>
                <span className={styles.playerName} style={{ background: '#e5e7eb', color: 'transparent', borderRadius: 4, minWidth: 120, display: 'inline-block' }}>&nbsp;</span>
                <span className={styles.playerScore} style={{ background: '#e5e7eb', color: 'transparent', borderRadius: 4, minWidth: 80, display: 'inline-block' }}>&nbsp;</span>
              </li>
            ))}
            {!loading && globalTop && globalTop.length === 0 && (
              <li className={styles.leaderboardItem}>No data</li>
            )}
            {!loading && globalTop && globalTop.map((p: any, idx: number) => (
              <li key={p.user_id} className={styles.leaderboardItem}>
                <span className={`${styles.rank} ${idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : idx === 2 ? styles.rank3 : ''}`}>{idx + 1}</span>
                <div className={styles.avatar}>{(p.profiles?.username || p.user_id || '').charAt(0) || '?'}</div>
                <span className={styles.playerName}>{p.profiles?.username || p.user_id}</span>
                <span className={styles.playerScore}>{Number(p.xp_this_week || 0).toLocaleString()} XP</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Friends Leaderboard */}
         <div className={`${styles.card} ${styles.leaderboardCard}`}>
          <div className={styles.leaderboardHeader}>
            <h3>Friends Leaderboard</h3>
            <span style={{color: '#888', fontSize: '0.9rem'}}>This Week</span>
          </div>
          <ul className={styles.leaderboardList}>
            {loading && Array.from({ length: 5 }).map((_, idx) => (
              <li key={`friends-skeleton-${idx}`} className={styles.leaderboardItem}>
                <span className={`${styles.rank} ${idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : idx === 2 ? styles.rank3 : ''}`} style={{ background: '#e5e7eb', color: 'transparent' }}>0</span>
                <div className={styles.avatar} style={{ background: '#e5e7eb', color: 'transparent' }}>A</div>
                <span className={styles.playerName} style={{ background: '#e5e7eb', color: 'transparent', borderRadius: 4, minWidth: 120, display: 'inline-block' }}>&nbsp;</span>
                <span className={styles.playerScore} style={{ background: '#e5e7eb', color: 'transparent', borderRadius: 4, minWidth: 80, display: 'inline-block' }}>&nbsp;</span>
              </li>
            ))}
            {!loading && friendsTop && friendsTop.length === 0 && (
              <li className={styles.leaderboardItem}>No friends data</li>
            )}
            {!loading && friendsTop && friendsTop.map((p: any, idx: number) => (
              <li key={p.user_id} className={styles.leaderboardItem}>
                <span className={`${styles.rank} ${idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : idx === 2 ? styles.rank3 : ''}`}>{idx + 1}</span>
                <div className={styles.avatar}>{(p.profiles?.username || p.user_id || '').charAt(0) || '?'}</div>
                <span className={styles.playerName}>{p.profiles?.username || p.user_id}</span>
                <span className={styles.playerScore}>{Number(p.xp_this_week || 0).toLocaleString()} XP</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
