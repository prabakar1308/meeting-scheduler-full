import 'dotenv/config';
import { agentGraph } from "./graph/graph";

const slots = [
  {
    start: "2025-11-21T10:00:00Z",
    end: "2025-11-21T11:00:00Z",
    available: false,
  },
  {
    start: "2025-11-21T12:00:00Z",
    end: "2025-11-21T13:00:00Z",
    available: true,
  },
];

async function run() {
  const result = await agentGraph.invoke({
    slots,
    ctx: { organizer: "test@test.com" },
  });

  console.log(JSON.stringify(result.final_ranked, null, 2));
}

run();
