import { describe, it, expect } from 'vitest';
import { getLeagueFromElo, calculateEloChange } from './elo';

describe('getLeagueFromElo', () => {
  it('returns bronze for ELO < 1100', () => {
    expect(getLeagueFromElo(0)).toBe('bronze');
    expect(getLeagueFromElo(500)).toBe('bronze');
    expect(getLeagueFromElo(1099)).toBe('bronze');
  });

  it('returns silver for ELO 1100-1299', () => {
    expect(getLeagueFromElo(1100)).toBe('silver');
    expect(getLeagueFromElo(1200)).toBe('silver');
    expect(getLeagueFromElo(1299)).toBe('silver');
  });

  it('returns gold for ELO 1300-1599', () => {
    expect(getLeagueFromElo(1300)).toBe('gold');
    expect(getLeagueFromElo(1400)).toBe('gold');
    expect(getLeagueFromElo(1599)).toBe('gold');
  });

  it('returns platinum for ELO 1600-1999', () => {
    expect(getLeagueFromElo(1600)).toBe('platinum');
    expect(getLeagueFromElo(1800)).toBe('platinum');
    expect(getLeagueFromElo(1999)).toBe('platinum');
  });

  it('returns diamond for ELO 2000+', () => {
    expect(getLeagueFromElo(2000)).toBe('diamond');
    expect(getLeagueFromElo(3000)).toBe('diamond');
  });
});

describe('calculateEloChange', () => {
  it('returns object with winnerChange and loserChange', () => {
    const result = calculateEloChange(1200, 1200);
    expect(result).toHaveProperty('winnerChange');
    expect(result).toHaveProperty('loserChange');
  });

  it('winner and loser changes are symmetric', () => {
    const { winnerChange, loserChange } = calculateEloChange(1200, 1200);
    expect(winnerChange + loserChange).toBe(0);
  });

  it('underdog winner gains more than favorite winner', () => {
    const underdog = calculateEloChange(1000, 1400);
    const favorite = calculateEloChange(1400, 1000);
    expect(underdog.winnerChange).toBeGreaterThan(favorite.winnerChange);
  });
});
