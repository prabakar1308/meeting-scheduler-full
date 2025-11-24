import type { AgentState } from "../state";
export const parseJSONNode = async (state: AgentState) => {
  const txt = state.llm_output || "";
  const tryParse = (str: string) => {
    try {
      const obj = JSON.parse(str);
      return Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  };
  let parsed = tryParse(txt);
  if (!parsed) {
    const arr = txt.match(/\[[\s\S]*\]/m);
    if (arr) parsed = tryParse(arr[0]);
  }
  state.ranked_json = parsed;
  return state;
};
