"use client";

import React from 'react';
import styles from './TopNav.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from './AuthProvider';

export default function TopNav() {
  const router = useRouter();
  const { user, loading, signOut } = useSupabaseAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/">
          LingoLoco
        </Link>
      </div>

      <div className={styles.centerLinks}>
        {!user && <Link href="/">Home</Link>}
        <Link href="/learn">Learn</Link>
        <Link href="/compete">Compete</Link>
        <Link href="/chat">Chat</Link>
        <Link href="/dashboard/es">Dashboard</Link>
      </div>
      
      <div className={styles.rightLinks}>
        {loading ? null : user ? (
          <>
            <button type="button" className={styles.textLink} onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link href="/login" className={styles.textLink}>Login</Link>
            <Link href="/signup" className={styles.textLink}>Sign up</Link>
            <Link href="/signup" className={styles.ctaButton}>Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
}
