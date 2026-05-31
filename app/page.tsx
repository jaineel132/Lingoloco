import React from 'react';
import Link from 'next/link';
import styles from './page.module.css';

const LANGUAGE_CHIPS = [
  { text: 'Hello', label: 'English' },
  { text: 'Hola', label: 'Spanish' },
  { text: 'Bonjour', label: 'French' },
  { text: 'Hallo', label: 'German' },
  { text: 'Ciao', label: 'Italian' },
  { text: 'Ola', label: 'Portuguese' },
  { text: 'नमस्ते', label: 'Hindi' },
  { text: 'こんにちは', label: 'Japanese' },
  { text: '你好', label: 'Chinese' },
  { text: '안녕하세요', label: 'Korean' },
  { text: 'مرحبا', label: 'Arabic' },
  { text: 'שלום', label: 'Hebrew' },
  { text: 'Привет', label: 'Russian' },
  { text: 'สวัสดี', label: 'Thai' },
];

export default function Home() {
  return (
    <div className={styles.container}>
      <div className={styles.topSection}>
        <div className={styles.content}>
          <h1 className={styles.title}>
            From Words to Conversations
          </h1>
          <p className={styles.description}>
            At LingoLoco, every new Langauge is taught with<br/>
            precision, clarity, and a little bit of magic. We bring you<br/>
            language lessons that are as warm and welcoming as home.
          </p>
          <Link href="/signup">
            <button className={styles.shopButton}>
              Start Learning
            </button>
          </Link>
        </div>
      </div>
      
      <div className={styles.imageContainer}>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className={styles.waveSvg}>
          <path fill="#F4EBD9" d="M0,160L48,165.3C96,171,192,181,288,160C384,139,480,85,576,96C672,107,768,181,864,208C960,235,1056,213,1152,186.7C1248,160,1344,128,1392,112L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
        </svg>
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div className={styles.languageCloud}>
          {LANGUAGE_CHIPS.map((chip, index) => (
            <div key={`${chip.label}-${index}`} className={styles.languageChip}>
              <span className={styles.chipText}>{chip.text}</span>
              <span className={styles.chipLabel}>{chip.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
