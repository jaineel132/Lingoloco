import React from 'react';
import styles from './Sidebar.module.css';
import Link from 'next/link';

export default function Sidebar() {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <h1 className={styles.logo}>LingoLoco</h1>
        <p className={styles.tagline}>Languages for Everyone</p>
      </div>
      <ul className={styles.navLinks}>
        <li><Link href="/">Home</Link></li>
        <li><Link href="/courses">Courses</Link></li>
        <li><Link href="/community">Community</Link></li>
        <li><Link href="/about">About Us</Link></li>
      </ul>
      <div className={styles.bottomSection}>
        <button className={styles.ctaButton}>Get Started</button>
      </div>
    </nav>
  );
}
