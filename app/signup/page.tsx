"use client";

import React, { useEffect, useState } from 'react';
import styles from '../../components/Auth.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../../components/AuthProvider';

export default function Signup() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState('/learn');
  const { signUpWithEmail, signInWithGoogle } = useSupabaseAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      setRedirectTo(redirect);
    }
  }, []);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage('');

    try {
      await signUpWithEmail(email.trim(), password, name.trim() || 'Language Learner');
      setStatusMessage('Account created. Redirecting...');
      router.push(redirectTo);
    } catch (error: any) {
      setStatusMessage(error?.message || 'Signup failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backHome}>
        ← Back to Home
      </Link>
      
      <div className={styles.card}>
        <div className={styles.logo}>LingoLoco</div>
        <h1 className={styles.title}>Create an account</h1>
        <p className={styles.subtitle}>Start learning languages today!</p>
        
        <form className={styles.form} onSubmit={handleSignup}>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="name">Full Name</label>
            <input 
              type="text" 
              id="name" 
              className={styles.input} 
              placeholder="John Doe" 
              value={name}
              onChange={(event) => setName(event.target.value)}
              required 
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="email">Email address</label>
            <input 
              type="email" 
              id="email" 
              className={styles.input} 
              placeholder="you@example.com" 
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required 
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              className={styles.input} 
              placeholder="••••••••" 
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required 
            />
          </div>
          
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        {statusMessage ? <p className={styles.footerText}>{statusMessage}</p> : null}
        
        <div className={styles.divider}>or</div>
        
        <button type="button" onClick={() => signInWithGoogle(redirectTo)} className={styles.socialBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className={styles.footerText}>
          Already have an account? <Link href="/login" className={styles.link}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
