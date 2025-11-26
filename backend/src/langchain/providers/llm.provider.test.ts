import { LLMProvider } from './llm.provider';
import { AzureChatOpenAI } from '@langchain/openai';

async function testAzureProvider() {
    console.log('Testing Azure OpenAI Provider Selection...');

    // Mock environment variables
    process.env.GROQ_API_KEY = '';
    process.env.OPENAI_API_KEY = '';
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_API_INSTANCE_NAME = 'test-instance';
    process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = 'test-deployment';

    try {
        // Test provider detection
        const provider = LLMProvider.getProvider();
        console.log(`Provider detected: ${provider}`);
        if (provider !== 'azure') {
            throw new Error(`Expected provider to be 'azure', but got '${provider}'`);
        }

        // Test model creation
        const model = LLMProvider.createChatModel({ task: 'general' });
        console.log('Model created successfully');

        if (model instanceof AzureChatOpenAI) {
            console.log('SUCCESS: Model is instance of AzureChatOpenAI');
        } else {
            throw new Error('Model is NOT instance of AzureChatOpenAI');
        }

        // Test structured output support
        const supportsStructured = LLMProvider.supportsStructuredOutput();
        console.log(`Supports structured output: ${supportsStructured}`);
        if (!supportsStructured) {
            throw new Error('Azure OpenAI should support structured output');
        }

    } catch (error) {
        console.error('FAILED:', error);
        process.exit(1);
    }
}

testAzureProvider();
