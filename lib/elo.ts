export const K_FACTOR = 32;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateEloChange(
  winnerRating: number,
  loserRating: number
): { winnerChange: number; loserChange: number } {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  const winnerChange = Math.round(K_FACTOR * (1 - expectedWinner));
  const loserChange = Math.round(K_FACTOR * (0 - expectedLoser));

  return { winnerChange, loserChange };
}

export function getLeagueFromElo(elo: number): string {
  if (elo >= 2000) return 'diamond';
  if (elo >= 1600) return 'platinum';
  if (elo >= 1300) return 'gold';
  if (elo >= 1100) return 'silver';
  return 'bronze';
}
