import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { RunnableSequence } from "@langchain/core/runnables";

import { slotListPrompt } from "../../prompts";
import type { AgentState } from "../state";

export const llmRankNode = async (state: AgentState) => {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();

  let model: any;

  if (provider === "openai") {
    model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
    });
  } else if (provider === "anthropic") {
    model = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      modelName: process.env.ANTHROPIC_MODEL || "claude-3-sonnet",
      temperature: 0.2,
    });
  } else {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }

  const prompt = slotListPrompt(state.slots, state.ctx);

  // LangChain runnable pipeline
  const pipeline = RunnableSequence.from([() => prompt, model]);

  const response = await pipeline.invoke({});

  // Extract text safely
  const content =
    response?.content ??
    (Array.isArray(response) ? response[0]?.content : null) ??
    response?.text ??
    response ??
    "";

  state.llm_output =
    typeof content === "string" ? content : JSON.stringify(content);

  return state;
};
