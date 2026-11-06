export type RoundPhase =
  | "SELECT_TRACK"
  | "READY"
  | "PRE"
  | "PRE_A"
  | "PRE_B"
  | "DANCER_A"
  | "TRANSITION"
  | "DANCER_B"
  | "POST_B"
  | "JUDGING"
  | "TRANSITION_TO_NEXT"
  | "INTER_ROUND_BG"
  | "END_ROUND";
export interface RoundState {
  selectedTrackId?: string;
  phase: RoundPhase;
}
export interface RoundHistoryItem {
  id: string;
  trackId: string;
  startedAt: number;
  dancerAStartedAt?: number;
  dancerBStartedAt?: number;
  judgingStartedAt?: number;
  endedAt?: number;
}
export interface Segment {
  segmentStart: number;
  segmentEnd: number;
  preRoll: number;
}
