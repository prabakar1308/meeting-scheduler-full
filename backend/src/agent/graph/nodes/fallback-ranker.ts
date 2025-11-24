import type { AgentState, RankedSlot } from "../state"; // Adjusted the path to match the correct module location
export const fallbackRankerNode = async (state: AgentState) => {
  const slots = state.slots;
  const ranked: RankedSlot[] = slots
    .slice()
    .sort((a, b) => {
      const avA = a.available ? 0 : 1;
      const avB = b.available ? 0 : 1;
      if (avA !== avB) return avA - avB;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    })
    .map((s, i) => ({
      rank: i + 1,
      start: s.start,
      end: s.end,
      score: s.available ? 0.9 - i * 0.01 : 0.1,
      reason: s.available ? "Available & earliest" : "Unavailable",
    }));
  state.final_ranked = ranked;
  return state;
};
