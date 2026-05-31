export type ProgressSnapshot = {
  xp: number;
  streak: number;
  dailyGoalMinutes: number;
  dailyProgressMinutes: number;
  dailyXpToday?: number;
  dailyScenariosToday?: number;
  lessonsCompleted: number;
  totalTimeHours: number;
  lastPracticeDateKey?: string | null;
  practiceCompletedSetKeys?: string[];
  practiceCompletedSessionIds?: number[];
  lastPracticeSessionId?: number | null;
  lastPracticeSetId?: number | null;
  lastPracticeSessionLabel?: string | null;
  lastPracticeSetLabel?: string | null;
};

export type PracticeCompletionInput = {
  sessionMinutes: number;
  xpEarned: number;
  sessionId?: number;
  setId?: number;
  sessionLabel?: string;
  setLabel?: string;
  totalSessions?: number;
  setsPerSession?: number;
  completedAt?: Date;
};

export type PracticeRoadmapSummary = {
  totalSessions: number;
  setsPerSession: number;
  totalSets: number;
  completedSessions: number;
  completedSets: number;
  roadmapProgressPercent: number;
  currentSessionId: number;
  currentSetId: number;
  currentSessionLabel: string;
  currentSetLabel: string;
  nextActionLabel: string;
};

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values)).filter((value) => Number.isInteger(value) && value > 0);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildSetKey(sessionId: number, setId: number) {
  return `${sessionId}:${setId}`;
}

function inferCurrentSessionId(completedSessionIds: number[], totalSessions: number) {
  for (let sessionId = 1; sessionId <= totalSessions; sessionId += 1) {
    if (!completedSessionIds.includes(sessionId)) {
      return sessionId;
    }
  }

  return totalSessions;
}

function inferCurrentSetId(completedSetKeys: string[], sessionId: number, setsPerSession: number) {
  for (let setId = 1; setId <= setsPerSession; setId += 1) {
    if (!completedSetKeys.includes(buildSetKey(sessionId, setId))) {
      return setId;
    }
  }

  return setsPerSession;
}

function inferCurrentLabels(input: {
  currentSessionId: number;
  currentSetId: number;
  sessionLabel?: string;
  setLabel?: string;
}) {
  const currentSessionLabel = input.sessionLabel?.trim() || `Session ${input.currentSessionId}`;
  const currentSetLabel = input.setLabel?.trim() || `Set ${input.currentSetId}`;

  return {
    currentSessionLabel,
    currentSetLabel,
    nextActionLabel: `${currentSessionLabel} • ${currentSetLabel}`,
  };
}

function normalizeDateKey(value: Date | string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

export function getCurrentDateKey(date = new Date()) {
  return normalizeDateKey(date);
}

function isYesterday(previousKey: string, currentKey: string) {
  if (!previousKey || !currentKey) {
    return false;
  }

  const previousDate = new Date(`${previousKey}T00:00:00.000Z`);
  const currentDate = new Date(`${currentKey}T00:00:00.000Z`);
  const dayDifference = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);

  return dayDifference === 1;
}

export function buildProgressSummary(user: ProgressSnapshot) {
  const todayKey = getCurrentDateKey();
  const lastPracticeDateKey = user.lastPracticeDateKey ? normalizeDateKey(user.lastPracticeDateKey) : '';
  const xp = Number(user.xp || 0);
  const streak = Number(user.streak || 0);
  const dailyProgressMinutes = lastPracticeDateKey === todayKey ? Number(user.dailyProgressMinutes || 0) : 0;
  const dailyXpToday = lastPracticeDateKey === todayKey ? Number(user.dailyXpToday || 0) : 0;
  const dailyScenariosToday = lastPracticeDateKey === todayKey ? Number(user.dailyScenariosToday || 0) : 0;
  const dailyGoalMinutes = Math.max(1, Number(user.dailyGoalMinutes || 1));
  const dailyProgressPercent = Math.min(100, Math.round((dailyProgressMinutes / dailyGoalMinutes) * 100));
  const totalSessions = 10;
  const setsPerSession = 7;
  const totalSets = totalSessions * setsPerSession;
  const completedSetKeys = uniqueStrings(user.practiceCompletedSetKeys || []);
  const completedSessionIds = uniqueNumbers(user.practiceCompletedSessionIds || []);
  const currentSessionId = inferCurrentSessionId(completedSessionIds, totalSessions);
  const currentSetId = inferCurrentSetId(completedSetKeys, currentSessionId, setsPerSession);
  const currentLabels = inferCurrentLabels({
    currentSessionId,
    currentSetId,
    sessionLabel: user.lastPracticeSessionLabel || undefined,
    setLabel: user.lastPracticeSetLabel || undefined,
  });

  return {
    xp,
    streak,
    dailyGoalMinutes,
    dailyProgressMinutes,
    dailyProgressPercent,
    dailyQuest: {
      xpGoal: 50,
      xpCurrent: dailyXpToday,
      xpPercent: Math.min(100, Math.round((dailyXpToday / 50) * 100)),
      xpCompleted: dailyXpToday >= 50,
      scenariosGoal: 2,
      scenariosCurrent: dailyScenariosToday,
      scenariosPercent: Math.min(100, Math.round((dailyScenariosToday / 2) * 100)),
      scenariosCompleted: dailyScenariosToday >= 2,
    },
    dailyGoalReached: dailyProgressMinutes >= dailyGoalMinutes,
    lessonsCompleted: Number(user.lessonsCompleted || 0),
    totalTimeHours: Number(user.totalTimeHours || 0),
    practiceRoadmap: {
      totalSessions,
      setsPerSession,
      totalSets,
      completedSessions: completedSessionIds.length,
      completedSets: completedSetKeys.length,
      roadmapProgressPercent: totalSets > 0 ? Math.min(100, Math.round((completedSetKeys.length / totalSets) * 100)) : 0,
      currentSessionId,
      currentSetId,
      currentSessionLabel: currentLabels.currentSessionLabel,
      currentSetLabel: currentLabels.currentSetLabel,
      nextActionLabel: currentLabels.nextActionLabel,
    },
    progressMessage: dailyProgressMinutes >= dailyGoalMinutes
      ? 'Daily goal completed'
      : `${Math.max(0, dailyGoalMinutes - dailyProgressMinutes)} min to daily goal`,
  };
}

export function applyPracticeCompletion(user: ProgressSnapshot, input: PracticeCompletionInput) {
  const completedAt = input.completedAt ?? new Date();
  const currentDateKey = getCurrentDateKey(completedAt);
  const previousDateKey = user.lastPracticeDateKey ? normalizeDateKey(user.lastPracticeDateKey) : '';
  const sessionMinutes = Math.max(1, Math.round(input.sessionMinutes || 0));
  const xpEarned = Math.max(0, Math.round(input.xpEarned || 0));
  const xp = Number(user.xp || 0);
  const streak = Number(user.streak || 0);
  const dailyProgressMinutes = Number(user.dailyProgressMinutes || 0);
  const dailyXpToday = Number(user.dailyXpToday || 0);
  const dailyScenariosToday = Number(user.dailyScenariosToday || 0);
  const lessonsCompleted = Number(user.lessonsCompleted || 0);
  const totalTimeHours = Number(user.totalTimeHours || 0);
  const continuingStreak = previousDateKey === currentDateKey || isYesterday(previousDateKey, currentDateKey);
  const nextDailyProgressMinutes = previousDateKey === currentDateKey ? dailyProgressMinutes + sessionMinutes : sessionMinutes;
  const previousDailyXp = previousDateKey === currentDateKey ? dailyXpToday : 0;
  const previousDailyScenarios = previousDateKey === currentDateKey ? dailyScenariosToday : 0;
  const totalSessions = Math.max(1, Math.round(input.totalSessions || 10));
  const setsPerSession = Math.max(1, Math.round(input.setsPerSession || 7));
  const sessionId = Math.max(1, Math.round(input.sessionId || 1));
  const setId = Math.max(1, Math.round(input.setId || 1));
  const setKey = buildSetKey(sessionId, setId);
  const completedSetKeys = uniqueStrings([...(user.practiceCompletedSetKeys || []), setKey]);
  const sessionCompletedSetCount = completedSetKeys.filter((key) => key.startsWith(`${sessionId}:`)).length;
  const practiceCompletedSessionIds = uniqueNumbers([
    ...(user.practiceCompletedSessionIds || []),
    ...(sessionCompletedSetCount >= setsPerSession ? [sessionId] : []),
  ]);
  const isNewSetCompletion = !(user.practiceCompletedSetKeys || []).includes(setKey);

  return {
    xp: xp + (isNewSetCompletion ? xpEarned : 0),
    streak: previousDateKey === currentDateKey ? streak : continuingStreak ? streak + 1 : 1,
    dailyProgressMinutes: nextDailyProgressMinutes,
    dailyXpToday: isNewSetCompletion ? previousDailyXp + xpEarned : previousDailyXp,
    dailyScenariosToday: isNewSetCompletion ? previousDailyScenarios + 1 : previousDailyScenarios,
    lessonsCompleted: lessonsCompleted + (isNewSetCompletion ? 1 : 0),
    totalTimeHours: Number((totalTimeHours + sessionMinutes / 60).toFixed(2)),
    lastPracticeDateKey: currentDateKey,
    lastPracticeAt: completedAt,
    practiceCompletedSetKeys: completedSetKeys,
    practiceCompletedSessionIds,
    lastPracticeSessionId: sessionId,
    lastPracticeSetId: setId,
    lastPracticeSessionLabel: input.sessionLabel?.trim() || null,
    lastPracticeSetLabel: input.setLabel?.trim() || null,
    practiceRoadmap: {
      totalSessions,
      setsPerSession,
      totalSets: totalSessions * setsPerSession,
      completedSessions: practiceCompletedSessionIds.length,
      completedSets: completedSetKeys.length,
      roadmapProgressPercent: Math.min(100, Math.round((completedSetKeys.length / (totalSessions * setsPerSession)) * 100)),
      currentSessionId: inferCurrentSessionId(practiceCompletedSessionIds, totalSessions),
      currentSetId: inferCurrentSetId(completedSetKeys, inferCurrentSessionId(practiceCompletedSessionIds, totalSessions), setsPerSession),
      currentSessionLabel: input.sessionLabel?.trim() || `Session ${sessionId}`,
      currentSetLabel: input.setLabel?.trim() || `Set ${setId}`,
      nextActionLabel: `${input.sessionLabel?.trim() || `Session ${sessionId}`} • ${input.setLabel?.trim() || `Set ${setId}`}`,
    } satisfies PracticeRoadmapSummary,
  };
}
