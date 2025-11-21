export type Team = {
  id: string;
  name: string;
  color: string;
  secondary: string;
};

export type PlayerCar = {
  color: string;
  name: string;
  team: string;
  teamId: string;
};

export type Player = {
  id: string;
  name: string;
  team: string;
  color: string;
  ready: boolean;
  x?: number;
  y?: number;
  lap?: number;
  isMe?: boolean;
};

export type Opponent = Omit<Player, 'isMe'>;

export type GameState = 'menu' | 'lobby' | 'race' | 'finished';
