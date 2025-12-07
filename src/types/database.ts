// Minimale typed schema; breid uit als nodig
export type Player = { id: string; name: string };
export type Match = {
  id: string;
  date: string;
  season: number;
  best_of: number;
  first_breaker_id: string | null;
  winner_id: string | null;
  notes: string | null;
};
export type Frame = {
  id: string;
  match_id: string;
  frame_no: number;
  nik_score: number;
  roel_score: number;
  winner_id: string | null;
  breaker_id: string | null;
  season: number;
};
export type Break = {
  id: string;
  match_id: string;
  frame_id: string | null;
  player_id: string;
  points: number;
  season: number;
};

export type Database = {
  public: {
    Tables: {
      players: { Row: Player; Insert: Player; Update: Partial<Player> };
      matches: { Row: Match; Insert: Omit<Match, 'id'> & { id?: string }; Update: Partial<Match> };
      frames: { Row: Frame; Insert: Omit<Frame, 'id'> & { id?: string }; Update: Partial<Frame> };
      breaks: { Row: Break; Insert: Omit<Break, 'id'> & { id?: string }; Update: Partial<Break> };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
