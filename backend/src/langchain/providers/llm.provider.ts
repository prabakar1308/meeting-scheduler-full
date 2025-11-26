import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';

/**
 * Multi-modal LLM provider that supports OpenAI, Azure OpenAI, and Groq
 * Automatically falls back to available provider
 */
export class LLMProvider {
    /**
     * Create a chat model with automatic provider selection
     * Priority: Groq (free) > Azure OpenAI (enterprise) > OpenAI (paid)
     */
    static createChatModel(options: {
        task: 'intent' | 'extraction' | 'agent' | 'general';
        temperature?: number;
    }) {
        const { task, temperature = 0 } = options;

        // Check which API keys are available
        const hasGroq = !!process.env.GROQ_API_KEY;
        const hasAzure = !!process.env.AZURE_OPENAI_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;

        if (!hasGroq && !hasAzure && !hasOpenAI) {
            throw new Error('No LLM API key found. Please set GROQ_API_KEY, AZURE_OPENAI_API_KEY, or OPENAI_API_KEY in .env');
        }

        // Select model based on task and available provider
        if (hasGroq) {
            return this.createGroqModel(task, temperature);
        } else if (hasAzure) {
            return this.createAzureOpenAIModel(task, temperature);
        } else {
            return this.createOpenAIModel(task, temperature);
        }
    }

    /**
     * Create Groq model (FREE, FAST)
     */
    private static createGroqModel(task: string, temperature: number) {
        const modelMap: Record<string, string> = {
            intent: 'llama-3.3-70b-versatile',      // Fast and accurate for classification
            extraction: 'llama-3.3-70b-versatile',  // Accurate for entity extraction
            agent: 'llama-3.3-70b-versatile',       // Best for conversation
            general: 'llama-3.3-70b-versatile'      // Default to best model
        };

        return new ChatGroq({
            model: modelMap[task] || modelMap.general,
            temperature,
            apiKey: process.env.GROQ_API_KEY,
        });
    }

    /**
     * Create Azure OpenAI model (ENTERPRISE, SECURE)
     */
    private static createAzureOpenAIModel(task: string, temperature: number) {
        // For Azure, we typically use the deployment name which maps to a specific model
        // We can use env vars to map tasks to deployments if needed, or default to a single deployment
        const deploymentName = process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;

        return new AzureChatOpenAI({
            azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
            azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
            azureOpenAIApiDeploymentName: deploymentName,
            azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview",
            temperature,
        });
    }

    /**
     * Create OpenAI model (PAID, HIGH QUALITY)
     */
    private static createOpenAIModel(task: string, temperature: number) {
        const modelMap: Record<string, string> = {
            intent: 'gpt-4o-mini',      // Fast and cheap
            extraction: 'gpt-4o-mini',  // Good enough for extraction
            agent: 'gpt-4o',            // Best for conversation
            general: 'gpt-4o-mini'      // Default to cheaper model
        };

        return new ChatOpenAI({
            modelName: modelMap[task] || modelMap.general,
            temperature,
            openAIApiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Get current provider name
     */
    static getProvider(): 'groq' | 'azure' | 'openai' | 'none' {
        if (process.env.GROQ_API_KEY) return 'groq';
        if (process.env.AZURE_OPENAI_API_KEY) return 'azure';
        if (process.env.OPENAI_API_KEY) return 'openai';
        return 'none';
    }

    /**
     * Check if provider supports structured output
     */
    static supportsStructuredOutput(): boolean {
        // OpenAI and Azure OpenAI support StructuredOutputParser
        const provider = this.getProvider();
        return provider === 'openai' || provider === 'azure';
    }
}
