import { Injectable } from '@nestjs/common';
@Injectable()
export class LangGraphDependencies {
  // Placeholder for DI of LLM clients if needed in the future.
  // Currently nodes instantiate their own LangChain models using env vars.
}
