export interface Slot {
  start: string;
  end: string;
  available?: boolean;
}
export interface RankedSlot {
  rank: number;
  start: string;
  end: string;
  score: number;
  reason: string;
}
export interface AgentState {
  slots: Slot[];
  ctx: any;
  llm_output?: string | null;
  ranked_json?: RankedSlot[] | null;
  final_ranked?: RankedSlot[] | null;
}

export type AgentNodes = {
  llm_rank: any;
  parse_json: any;
  route: any;
  good_json: any;
  fallback: any;
};
