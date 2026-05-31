export type CompeteSquad = {
  id: number;
  name: string;
  lang: string;
  baseMembers: number;
  maxMembers: number;
  score: string;
  icon: string;
};

export const COMPETE_SQUADS: CompeteSquad[] = [
  { id: 1, name: 'Polyglot Pioneers', lang: 'Mixed', baseMembers: 12, maxMembers: 25, score: '124,500 XP', icon: '🌐' },
  { id: 2, name: 'Spanish Inquisition', lang: 'Spanish', baseMembers: 8, maxMembers: 20, score: '89,200 XP', icon: '🇪🇸' },
];

export function getSquadById(id: number) {
  return COMPETE_SQUADS.find((squad) => squad.id === id) || null;
}
