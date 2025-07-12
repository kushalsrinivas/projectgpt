# Implementation Guide

## ProjectGPT - AI Chat Platform

**Version:** 1.0.0  
**Last Updated:** January 2025

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18.x or higher
- **Bun**: Latest version (recommended) or npm/yarn
- **PostgreSQL**: Version 14.x or higher
- **Git**: Version control
- **VS Code**: Recommended IDE with extensions

### Required VS Code Extensions

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "biomejs.biome",
    "ms-vscode.vscode-json"
  ]
}
```

## 🔧 Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/projectgpt.git
cd projectgpt
```

### 2. Install Dependencies

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### 3. Environment Configuration

Create `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/projectgpt"

# NextAuth.js
AUTH_SECRET="your-auth-secret-here"

# Google OAuth
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# OpenRouter API
OPENROUTER_API_KEY="your-openrouter-api-key"

# Environment
NODE_ENV="development"
```

### 4. Database Setup

```bash
# Start PostgreSQL (if using Docker)
docker run --name projectgpt-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres

# Or use the provided script
./start-database.sh

# Push database schema
bun run db:push

# Optional: Seed database
bun run db:seed
```

### 5. Development Server

```bash
# Start development server
bun run dev

# Server will be available at http://localhost:3000
```

## 🏗️ Development Workflow

### Branch Strategy

```
main (production)
├── develop (development)
├── feature/feature-name
├── bugfix/bug-description
└── hotfix/critical-fix
```

### Commit Convention

```bash
# Format: type(scope): description
feat(chat): add multi-model support
fix(auth): resolve OAuth callback issue
docs(readme): update setup instructions
style(ui): improve chat interface styling
refactor(api): optimize database queries
test(chat): add unit tests for message handling
```

### Development Commands

```bash
# Development
bun run dev              # Start development server
bun run dev:turbo        # Start with Turbo (faster)

# Building
bun run build           # Build for production
bun run start           # Start production server
bun run preview         # Preview production build

# Code Quality
bun run check           # Run Biome linter
bun run check:write     # Fix linting issues
bun run check:unsafe    # Fix with unsafe changes
bun run typecheck       # TypeScript type checking

# Database
bun run db:generate     # Generate migrations
bun run db:push         # Push schema changes
bun run db:migrate      # Run migrations
bun run db:studio       # Open Drizzle Studio
```

## 📁 Project Structure

```
projectgpt/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── _components/       # Page-specific components
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/            # Reusable components
│   │   ├── chat/              # Chat-specific components
│   │   ├── ui/                # UI primitives
│   │   └── theme-provider.tsx # Theme context
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility libraries
│   ├── server/                # Server-side code
│   │   ├── api/               # tRPC routers
│   │   ├── auth/              # Authentication config
│   │   └── db/                # Database schema
│   ├── styles/                # Global styles
│   └── trpc/                  # tRPC client setup
├── docs/                      # Documentation
├── drizzle/                   # Database migrations
├── public/                    # Static assets
└── config files               # Configuration files
```

## 🎨 Coding Standards

### TypeScript Guidelines

```typescript
// Use strict typing
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
}

// Prefer type over interface for unions
type UserTier = "free" | "pro" | "enterprise";

// Use const assertions for immutable data
const SUPPORTED_MODELS = ["gpt-4", "gpt-3.5-turbo", "claude-3-sonnet"] as const;

// Avoid any, use unknown for dynamic data
function processApiResponse(data: unknown): ChatMessage {
  // Type validation with Zod
  return chatMessageSchema.parse(data);
}
```

### React Component Guidelines

```tsx
// Use functional components with hooks
interface ChatAreaProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ChatArea({ selectedModel, onModelChange }: ChatAreaProps) {
  // Destructure props
  // Use descriptive state names
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Custom hooks for complex logic
  const { sendMessage, isError } = useChatMutation();

  // Event handlers
  const handleSubmit = useCallback(
    async (message: string) => {
      setIsLoading(true);
      try {
        await sendMessage({ message, model: selectedModel });
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage, selectedModel]
  );

  return <div className="flex flex-col h-full">{/* Component JSX */}</div>;
}
```

### CSS/Tailwind Guidelines

```tsx
// Use semantic class names
<div className="chat-container">
  <div className="message-list">
    <div className="message message--user">
      User message
    </div>
    <div className="message message--assistant">
      AI response
    </div>
  </div>
</div>

// Prefer Tailwind utilities
<div className="flex flex-col h-full bg-background">
  <div className="flex-1 overflow-y-auto p-4">
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Content */}
    </div>
  </div>
</div>

// Use CSS variables for theming
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
}
```

## 🧪 Testing Strategy

### Unit Testing

```typescript
// Test utilities
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatArea } from "../chat-area";

describe("ChatArea", () => {
  it("should send message on form submit", async () => {
    const mockSendMessage = jest.fn();
    render(<ChatArea onSendMessage={mockSendMessage} />);

    const input = screen.getByPlaceholderText("Type your message...");
    const button = screen.getByText("Send");

    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(button);

    expect(mockSendMessage).toHaveBeenCalledWith("Hello");
  });
});
```

### Integration Testing

```typescript
// Test API endpoints
import { createMocks } from "node-mocks-http";
import handler from "../api/chat/send";

describe("/api/chat/send", () => {
  it("should handle authenticated requests", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { message: "Hello", model: "gpt-4" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
  });
});
```

### E2E Testing

```typescript
// Playwright tests
import { test, expect } from "@playwright/test";

test("guest user can send messages", async ({ page }) => {
  await page.goto("/");

  await page.fill('[placeholder="Type your message..."]', "Hello");
  await page.click("text=Send");

  await expect(page.locator(".message--assistant")).toBeVisible();
});
```

## 🔐 Security Best Practices

### Input Validation

```typescript
// Always validate inputs with Zod
const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  model: z.string().min(1),
  conversationId: z.string().uuid(),
});

export const sendMessage = protectedProcedure
  .input(sendMessageSchema)
  .mutation(async ({ input }) => {
    // Input is now type-safe and validated
  });
```

### Authentication

```typescript
// Use protectedProcedure for authenticated routes
export const getConversations = protectedProcedure.query(async ({ ctx }) => {
  // ctx.session.user is guaranteed to exist
  return await ctx.db.query.chatMessages.findMany({
    where: eq(chatMessages.userId, ctx.session.user.id),
  });
});
```

### Environment Variables

```typescript
// Use type-safe environment validation
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    OPENROUTER_API_KEY: z.string().min(1),
  },
  client: {
    // Client-side environment variables
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
});
```

## 📊 Performance Optimization

### Database Optimization

```typescript
// Use indexes for frequent queries
export const chatMessages = createTable(
  "chat_message",
  {
    // ... columns
  },
  (t) => [
    index("chat_message_user_id_idx").on(t.userId),
    index("chat_message_conversation_id_idx").on(t.conversationId),
  ]
);

// Optimize queries with proper relations
export const getConversationWithMessages = async (conversationId: string) => {
  return await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      messages: {
        orderBy: [desc(chatMessages.createdAt)],
        limit: 50,
      },
    },
  });
};
```

### Frontend Optimization

```tsx
// Use React.memo for expensive components
export const ChatMessage = React.memo(
  ({ message }: { message: ChatMessage }) => {
    return <div className="message">{message.content}</div>;
  }
);

// Lazy load heavy components
const ModelSelector = lazy(() => import("./model-selector"));

// Use useCallback for event handlers
const handleSendMessage = useCallback(
  async (message: string) => {
    await sendMessage({ message, model: selectedModel });
  },
  [sendMessage, selectedModel]
);
```

### API Optimization

```typescript
// Batch database operations
export const createMultipleMessages = async (messages: NewChatMessage[]) => {
  return await db.insert(chatMessages).values(messages);
};

// Use connection pooling
import { Pool } from "pg";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});
```

## 🚀 Deployment Guide

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variables (Production)

```bash
# Set via Vercel dashboard or CLI
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel env add AUTH_GOOGLE_ID
vercel env add AUTH_GOOGLE_SECRET
vercel env add OPENROUTER_API_KEY
```

### Database Migration

```bash
# Run migrations in production
bun run db:migrate

# Or push schema changes
bun run db:push
```

## 🔍 Debugging Guide

### Common Issues

#### Database Connection

```bash
# Check database connection
psql $DATABASE_URL

# Reset database
bun run db:push --force
```

#### Authentication Issues

```typescript
// Debug NextAuth
export default NextAuth({
  debug: process.env.NODE_ENV === "development",
  // ... config
});
```

#### API Errors

```typescript
// Add logging to tRPC procedures
export const sendMessage = protectedProcedure
  .input(sendMessageSchema)
  .mutation(async ({ input, ctx }) => {
    console.log("Sending message:", input);

    try {
      const result = await processMessage(input);
      console.log("Message sent successfully:", result);
      return result;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  });
```

### Development Tools

```bash
# Database studio
bun run db:studio

# Type checking
bun run typecheck

# Build analysis
npx @next/bundle-analyzer
```

## 📋 Code Review Checklist

### Before Submitting PR

- [ ] Code follows TypeScript strict mode
- [ ] All components are properly typed
- [ ] Database queries are optimized
- [ ] Environment variables are validated
- [ ] Error handling is implemented
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] Performance impact is considered

### Review Criteria

- [ ] Code is readable and maintainable
- [ ] Security best practices are followed
- [ ] Performance optimizations are applied
- [ ] Error handling is comprehensive
- [ ] Types are accurate and strict
- [ ] Database operations are efficient
- [ ] UI/UX is consistent with design system

## 🔄 Continuous Integration

### GitHub Actions Workflow

```yaml
name: CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck
      - run: bun run check
      - run: bun run test
      - run: bun run build
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["bun run check:write", "bun run typecheck"]
  }
}
```

## 📚 Additional Resources

### Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Tools

- [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview)
- [Biome Playground](https://biomejs.dev/playground/)
- [TypeScript Playground](https://www.typescriptlang.org/play)

---

_This implementation guide is updated regularly with new best practices and workflow improvements._
