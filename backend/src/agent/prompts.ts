export const slotListPrompt = (slots: any[], ctx: any) => {
  const slotText = slots
    .map(
      (s: any, i: number) =>
        `${i + 1}. start: ${s.start}, end: ${s.end}, available: ${
          s.available ?? true
        }`
    )
    .join("\n");

  return `
You are a meeting scheduler AI. Rank the following slots.

Slots:
${slotText}

Context:
${JSON.stringify(ctx)}

Return ONLY a JSON array in this exact format:

[
  {
    "rank": 1,
    "start": "2025-01-01T10:00:00Z",
    "end": "2025-01-01T11:00:00Z",
    "score": 0.95,
    "reason": "best option"
  }
]
`;
};
