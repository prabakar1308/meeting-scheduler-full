import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { Slot, RankedSlot, AgentState } from "./state";

import { llmRankNode } from "./nodes/llm-rank";
import { parseJSONNode } from "./nodes/parse-json";
import { fallbackRankerNode } from "./nodes/fallback-ranker";

// Define state using Annotation for LangGraph 1.0.2
const AgentStateAnnotation = Annotation.Root({
  slots: Annotation<Slot[]>,
  ctx: Annotation<any>,
  llm_output: Annotation<string | null>({
    value: (current, update) => update ?? current,
    default: () => null,
  }),
  ranked_json: Annotation<RankedSlot[] | null>({
    value: (current, update) => update ?? current,
    default: () => null,
  }),
  final_ranked: Annotation<RankedSlot[] | null>({
    value: (current, update) => update ?? current,
    default: () => null,
  }),
});

// Export the state type for use in nodes
export type GraphState = typeof AgentStateAnnotation.State;

// Route node - determines next step based on state
const routeNode = (state: GraphState) => {
  // Just return the state as-is; routing logic goes in the conditional function
  return state;
};

// Good JSON node - sets final_ranked from ranked_json
const goodJsonNode = (state: GraphState) => {
  return {
    final_ranked: state.ranked_json,
  };
};

// Conditional routing function
function routeDecision(state: GraphState): "good_json" | "fallback" {
  return state.ranked_json ? "good_json" : "fallback";
}

// Define the graph using StateGraph
const graph = new StateGraph(AgentStateAnnotation)
  .addNode("llm_rank", llmRankNode)
  .addNode("parse_json", parseJSONNode)
  .addNode("route", routeNode)
  .addNode("good_json", goodJsonNode)
  .addNode("fallback", fallbackRankerNode)
  // Linear edges
  .addEdge(START, "llm_rank")
  .addEdge("llm_rank", "parse_json")
  .addEdge("parse_json", "route")
  // Conditional routing from route node
  .addConditionalEdges("route", routeDecision, {
    good_json: "good_json",
    fallback: "fallback",
  })
  // Terminal edges
  .addEdge("good_json", END)
  .addEdge("fallback", END)
  .compile();

export const agentGraph = graph;
