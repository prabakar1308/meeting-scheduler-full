import { Injectable } from '@nestjs/common';
import { agentGraph } from './graph/graph';
import type { Slot } from './graph/state';

@Injectable()
export class AgentService {
  async rankSlots(slots: Slot[], ctx: any = {}) {
    const result = await agentGraph.invoke({
      slots,
      ctx
    });
    return result.final_ranked;
  }
}
