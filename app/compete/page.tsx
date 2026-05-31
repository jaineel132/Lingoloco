import React from 'react';
import Link from 'next/link';
import styles from "./page.module.css";

export default function CompetePage() {
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
            <h2>Diamond League</h2>
            <p>Top 20% promoted this week. You are in the promotion zone!</p>
          </div>
          <div className={styles.leagueBadge}>
            💎
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
            Ends in 48:15:22
          </div>
        </div>

        {/* Global Leaderboard */}
        <div className={`${styles.card} ${styles.leaderboardCard}`}>
          <div className={styles.leaderboardHeader}>
            <h3>Global Top 100</h3>
            <span style={{color: '#888', fontSize: '0.9rem'}}>Spanish</span>
          </div>
          <ul className={styles.leaderboardList}>
            <li className={styles.leaderboardItem}>
              <span className={`${styles.rank} ${styles.rank1}`}>1</span>
              <div className={styles.avatar}>A</div>
              <span className={styles.playerName}>Alex_Learn</span>
              <span className={styles.playerScore}>14,200 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={`${styles.rank} ${styles.rank2}`}>2</span>
              <div className={styles.avatar}>B</div>
              <span className={styles.playerName}>Bella99</span>
              <span className={styles.playerScore}>13,850 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={`${styles.rank} ${styles.rank3}`}>3</span>
              <div className={styles.avatar}>C</div>
              <span className={styles.playerName}>CarlosM</span>
              <span className={styles.playerScore}>13,100 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={styles.rank}>4</span>
              <div className={styles.avatar}>D</div>
              <span className={styles.playerName}>DianaP</span>
              <span className={styles.playerScore}>12,400 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={styles.rank}>5</span>
              <div className={styles.avatar}>E</div>
              <span className={styles.playerName}>Eduardo</span>
              <span className={styles.playerScore}>11,900 XP</span>
            </li>
          </ul>
        </div>

        {/* Friends Leaderboard */}
         <div className={`${styles.card} ${styles.leaderboardCard}`}>
          <div className={styles.leaderboardHeader}>
            <h3>Friends Leaderboard</h3>
            <span style={{color: '#888', fontSize: '0.9rem'}}>This Week</span>
          </div>
          <ul className={styles.leaderboardList}>
            <li className={styles.leaderboardItem}>
              <span className={`${styles.rank} ${styles.rank1}`}>1</span>
              <div className={styles.avatar}>Y</div>
              <span className={styles.playerName}>You</span>
              <span className={styles.playerScore}>2,400 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={`${styles.rank} ${styles.rank2}`}>2</span>
              <div className={styles.avatar}>J</div>
              <span className={styles.playerName}>JaneDoe</span>
              <span className={styles.playerScore}>1,850 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={`${styles.rank} ${styles.rank3}`}>3</span>
              <div className={styles.avatar}>M</div>
              <span className={styles.playerName}>Mike_T</span>
              <span className={styles.playerScore}>900 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={styles.rank}>4</span>
              <div className={styles.avatar}>S</div>
              <span className={styles.playerName}>SarahK</span>
              <span className={styles.playerScore}>750 XP</span>
            </li>
            <li className={styles.leaderboardItem}>
              <span className={styles.rank}>5</span>
              <div className={styles.avatar}>D</div>
              <span className={styles.playerName}>DavidL</span>
              <span className={styles.playerScore}>420 XP</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
