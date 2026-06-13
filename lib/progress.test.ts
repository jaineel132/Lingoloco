import { describe, it, expect } from 'vitest';
import { buildProgressSummary, applyPracticeCompletion, getCurrentDateKey } from './progress';

describe('buildProgressSummary', () => {
  const baseUser = {
    xp: 150,
    streak: 5,
    dailyGoalMinutes: 10,
    dailyProgressMinutes: 0,
    dailyXpToday: 0,
    dailyScenariosToday: 0,
    lessonsCompleted: 3,
    totalTimeHours: 2.5,
    lastPracticeDateKey: '',
    practiceCompletedSetKeys: [],
    practiceCompletedSessionIds: [],
    lastPracticeSessionId: null,
    lastPracticeSetId: null,
    lastPracticeSessionLabel: null,
    lastPracticeSetLabel: null,
  };

  it('returns correct daily progress when no practice today', () => {
    const result = buildProgressSummary(baseUser);
    expect(result.dailyProgressMinutes).toBe(0);
    expect(result.dailyProgressPercent).toBe(0);
    expect(result.dailyGoalReached).toBe(false);
  });

  it('returns correct daily progress when practiced today', () => {
    const todayKey = getCurrentDateKey();
    const result = buildProgressSummary({ ...baseUser, lastPracticeDateKey: todayKey, dailyProgressMinutes: 8 });
    expect(result.dailyProgressMinutes).toBe(8);
    expect(result.dailyProgressPercent).toBe(80);
    expect(result.dailyGoalReached).toBe(false);
  });

  it('marks daily goal as reached when >= goal minutes', () => {
    const todayKey = getCurrentDateKey();
    const result = buildProgressSummary({ ...baseUser, lastPracticeDateKey: todayKey, dailyProgressMinutes: 12 });
    expect(result.dailyGoalReached).toBe(true);
    expect(result.dailyProgressPercent).toBe(100);
  });

  it('computes roadmap progress correctly', () => {
    const result = buildProgressSummary({
      ...baseUser,
      practiceCompletedSetKeys: ['1:1', '1:2', '1:3'],
      practiceCompletedSessionIds: [],
    });
    expect(result.practiceRoadmap.completedSets).toBe(3);
    expect(result.practiceRoadmap.totalSets).toBe(70);
    expect(result.practiceRoadmap.roadmapProgressPercent).toBe(Math.round((3 / 70) * 100));
    expect(result.practiceRoadmap.currentSessionId).toBe(1);
    expect(result.practiceRoadmap.currentSetId).toBe(4);
  });

  it('shows daily quest xp progress', () => {
    const todayKey = getCurrentDateKey();
    const result = buildProgressSummary({ ...baseUser, lastPracticeDateKey: todayKey, dailyXpToday: 30 });
    expect(result.dailyQuest.xpCurrent).toBe(30);
    expect(result.dailyQuest.xpPercent).toBe(60);
    expect(result.dailyQuest.xpCompleted).toBe(false);
  });

  it('shows daily quest complete at 50 xp', () => {
    const todayKey = getCurrentDateKey();
    const result = buildProgressSummary({ ...baseUser, lastPracticeDateKey: todayKey, dailyXpToday: 50 });
    expect(result.dailyQuest.xpCompleted).toBe(true);
  });
});

describe('applyPracticeCompletion', () => {
  const baseUser = {
    xp: 100,
    streak: 3,
    dailyGoalMinutes: 10,
    dailyProgressMinutes: 0,
    dailyXpToday: 0,
    dailyScenariosToday: 0,
    lessonsCompleted: 2,
    totalTimeHours: 1.0,
    lastPracticeDateKey: '',
    lastPracticeAt: null,
    practiceCompletedSetKeys: [],
    practiceCompletedSessionIds: [],
    lastPracticeSessionId: null,
    lastPracticeSetId: null,
    lastPracticeSessionLabel: null,
    lastPracticeSetLabel: null,
  };

  it('adds xp and time for a new completion', () => {
    const result = applyPracticeCompletion(baseUser, {
      sessionMinutes: 15,
      xpEarned: 50,
      sessionId: 1,
      setId: 1,
      sessionLabel: 'Session 1',
      setLabel: 'Set 1',
    });

    expect(result.xp).toBe(150);
    expect(result.lessonsCompleted).toBe(3);
    expect(result.totalTimeHours).toBeCloseTo(1.25, 5);
    expect(result.practiceCompletedSetKeys).toContain('1:1');
  });

  it('does not double-count XP for an already completed set', () => {
    const result = applyPracticeCompletion(
      { ...baseUser, practiceCompletedSetKeys: ['1:1'] },
      { sessionMinutes: 15, xpEarned: 50, sessionId: 1, setId: 1 }
    );
    expect(result.xp).toBe(100);
    expect(result.lessonsCompleted).toBe(2);
  });

  it('completes a session when all 7 sets are done', () => {
    const completedKeys = Array.from({ length: 7 }, (_, i) => `1:${i + 1}`);
    const result = applyPracticeCompletion(
      { ...baseUser, practiceCompletedSetKeys: completedKeys.slice(0, 6) },
      { sessionMinutes: 10, xpEarned: 30, sessionId: 1, setId: 7 }
    );
    expect(result.practiceCompletedSessionIds).toContain(1);
  });

  it('starts a new streak when practiced on consecutive day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const result = applyPracticeCompletion(
      { ...baseUser, lastPracticeDateKey: yesterdayKey, streak: 3 },
      { sessionMinutes: 10, xpEarned: 20, sessionId: 2, setId: 1 }
    );
    expect(result.streak).toBe(4);
  });

  it('resets streak to 1 after missing a day', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const oldKey = twoDaysAgo.toISOString().slice(0, 10);

    const result = applyPracticeCompletion(
      { ...baseUser, lastPracticeDateKey: oldKey, streak: 5 },
      { sessionMinutes: 10, xpEarned: 20, sessionId: 1, setId: 1 }
    );
    expect(result.streak).toBe(1);
  });
});

describe('getCurrentDateKey', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const key = getCurrentDateKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns correct format for a given date', () => {
    const key = getCurrentDateKey(new Date('2026-06-13T12:00:00Z'));
    expect(key).toBe('2026-06-13');
  });
});
