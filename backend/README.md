# Meeting Scheduler Backend

This is the backend service for the AI-powered Meeting Scheduler application. It provides three distinct flows for scheduling meetings, ranging from fully autonomous AI agents to manual form-based scheduling.

## 🚀 Overview of Scheduling Flows

| Flow | Endpoint | Description | AI Stack |
|------|----------|-------------|----------|
| **1. Agent Chat** | `/agent-chat` | Fully autonomous AI agent that uses tools to check availability and schedule meetings. | **LangChain + MCP + Groq/OpenAI** |
| **2. Conversational Chat** | `/chat` | Semi-automated chat that classifies intent and extracts parameters. | **LangChain + Groq/OpenAI** |
| **3. Manual Scheduling** | `/scheduling` | Form-based scheduling with optional natural language parsing. | **OpenAI (Simple Mode)** |

---

## 🛠️ Technology Stack

### Core Frameworks
- **NestJS**: Main backend framework.
- **Prisma**: ORM for database interactions.
- **Microsoft Graph API**: For calendar operations (availability, scheduling).

### AI & Agents
- **Model Context Protocol (MCP)**: Standardizes how the AI agent interacts with tools (`suggest_meeting_times`, `schedule_meeting`).
- **LangChain**: Orchestrates LLM interactions, prompt management, and tool binding.
- **LangGraph**: Used for advanced slot ranking logic (experimental).
- **Models**:
  - **Groq (Llama 3)**: Primary model for high-speed inference.
  - **OpenAI (GPT-4)**: Fallback model for complex reasoning.

---

## 1️⃣ Flow: Agent Chat (Fully Autonomous)

This flow uses a sophisticated AI agent capable of multi-turn reasoning and tool execution.

### How it works
1. **User Input**: "Schedule a sync with Alice tomorrow at 2pm"
2. **LLM Processing**: The agent analyzes the request and decides to call a tool.
3. **Tool Execution (MCP)**:
   - The agent calls `suggest_meeting_times` via the **MCP Tool Adapter**.
   - The adapter validates parameters and calls the `SchedulingService`.
4. **Graph API**: Checks availability in Microsoft 365.
5. **Response**: The agent confirms availability and asks for final approval.
6. **Action**: Upon confirmation, the agent calls `schedule_meeting` to create the event.

### Key Components
- **`McpAgentService`**: Manages conversation history and LLM invocation.
- **`McpToolAdapter`**: Converts internal services into MCP-compatible tools.
- **`LLMProvider`**: Switches between Groq and OpenAI based on availability.

---

## 2️⃣ Flow: Conversational Chat (Semi-Automated)

This flow uses AI primarily for **Intent Classification** and **Parameter Extraction**.

### How it works
1. **User Input**: "Find time for a meeting with Bob"
2. **Intent Classification**: LLM determines if the user wants to `suggest`, `schedule`, or just `chat`.
3. **Parameter Extraction**: LLM extracts entities like `attendees`, `start_time`, `end_time`.
4. **Direct Execution**: The service calls the appropriate internal method (`suggestSlots` or `scheduleMeeting`) directly, bypassing the tool-calling loop.
5. **Response**: Returns a structured response or natural language text.

### Key Components
- **`ConversationalService`**: Handles intent classification and parameter extraction.
- **`LangchainController`**: Entry point for chat messages.

---

## 3️⃣ Flow: Manual Scheduling

This flow gives users full control via a UI, with an optional "Simple Mode" for natural language input.

### How it works
- **Advanced Mode**: User fills out a structured form (Date, Time, Attendees).
- **Simple Mode**:
  1. User types: "Meeting with Team tomorrow"
  2. **`parseNaturalLanguage`**: Uses OpenAI to extract JSON parameters.
  3. Frontend pre-fills the form with extracted data.
  4. User manually clicks "Check Availability" and "Schedule".

### Key Components
- **`SchedulingService`**: Core logic for Graph API interactions.
- **`SchedulingController`**: REST endpoints for the frontend.

---

## 🧩 Under the Hood: Stack Details

### Model Context Protocol (MCP)
Used in **Agent Chat**. We implement an MCP adapter that wraps our `SchedulingService` methods as standardized tools. This allows the LLM to "see" our API as executable functions with strict schemas.

**Tools Defined:**
- `suggest_meeting_times`: `{ organizer, attendees, start, end }`
- `schedule_meeting`: `{ organizer, attendees, start, end, subject }`

### LangChain
Used across **Agent Chat** and **Conversational Chat**.
- **Prompts**: Manages system messages and prompt templates.
- **Tool Binding**: Binds MCP tools to the LLM so the model knows how to call them.
- **Chains**: Manages the flow of data between the LLM and the application.

### LangGraph
Located in `src/agent/graph`.
- **Usage**: Currently implements a "Ranking Graph" to intelligently score and rank meeting slots based on preferences.
- **Status**: Advanced feature (integrated into specific workflows).

### Models (LLM Provider)
We use a **Hybrid Provider** strategy:
- **Groq**: Default for speed. Used for chat and simple extraction.
- **OpenAI**: Used for complex reasoning or if Groq is unavailable.
- **Configuration**: Set via `GROQ_API_KEY` and `OPENAI_API_KEY` in `.env`.

---

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Copy `.env.example` to `.env` and configure:
   - `AZURE_CLIENT_ID` / `SECRET` (for Graph API)
   - `GROQ_API_KEY` / `OPENAI_API_KEY` (for AI)
   - `DATABASE_URL` (for Prisma)

3. **Run Development Server**:
   ```bash
   npm run start:dev
   ```

4. **Test the Agent**:
   Visit `http://localhost:3000/agent-chat` to interact with the fully autonomous agent.
