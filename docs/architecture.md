# Project Architecture

## ProjectGPT - AI Chat Platform

**Version:** 1.0.0  
**Last Updated:** January 2025

---

## 🏗️ System Overview

ProjectGPT is built using the **T3 Stack** (TypeScript, Next.js, tRPC, Tailwind CSS) with additional components for AI model integration, authentication, and database management. The architecture follows a **full-stack TypeScript** approach with strong type safety throughout.

### Design Principles

- **Type Safety**: End-to-end TypeScript with strict typing
- **Performance**: Optimized for fast response times and scalability
- **Security**: Secure authentication and data isolation
- **Modularity**: Loosely coupled components for easy maintenance
- **Extensibility**: Plugin-ready architecture for future enhancements

## 🛠️ Technology Stack

### Frontend

- **Next.js 15.2.3**: React framework with App Router
- **React 19**: UI library with latest features
- **TypeScript 5.8.2**: Type-safe JavaScript
- **Tailwind CSS 4.0.15**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **next-themes**: Dark/light mode support

### Backend

- **Next.js API Routes**: Server-side API endpoints
- **tRPC 11.0.0**: Type-safe API layer
- **NextAuth.js 5.0.0**: Authentication framework
- **Drizzle ORM 0.41.0**: Type-safe database ORM
- **PostgreSQL**: Primary database
- **Zod**: Runtime type validation

### External Services

- **OpenRouter API**: Multi-model AI access
- **Google OAuth**: Authentication provider
- **Vercel**: Deployment and hosting platform

### Development Tools

- **Biome**: Code formatting and linting
- **Drizzle Kit**: Database migrations
- **Bun**: Package manager and runtime

## 🏛️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Chat Layout   │  │  Model Selector │  │  Context Panel  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Chat Area     │  │    Sidebar      │  │   MCP Panel     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ tRPC
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (tRPC)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Chat Router   │  │  Auth Router    │  │  Post Router    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Context Manager │  │  Rate Limiter   │  │ OpenRouter API  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ Drizzle ORM
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │     Users       │  │  Chat Messages  │  │  User Quotas    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Accounts      │  │    Sessions     │  │     Posts       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Database Schema

### Core Tables

#### Users

```sql
CREATE TABLE "projectgpt_user" (
  "id" varchar(255) PRIMARY KEY,
  "name" varchar(255),
  "email" varchar(255) NOT NULL,
  "emailVerified" timestamp,
  "image" varchar(255),
  "tier" varchar(20) DEFAULT 'free',
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
);
```

#### Chat Messages

```sql
CREATE TABLE "projectgpt_chat_message" (
  "id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  "userId" varchar(255) REFERENCES users(id),
  "conversationId" varchar(255) NOT NULL,
  "guestSessionId" varchar(255),
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "model" varchar(100),
  "tokensUsed" integer DEFAULT 0,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
);
```

#### User Quotas

```sql
CREATE TABLE "projectgpt_user_quota" (
  "id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  "userId" varchar(255) REFERENCES users(id),
  "requestsUsed" integer DEFAULT 0,
  "tokensUsed" integer DEFAULT 0,
  "lastReset" timestamp DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
);
```

### Authentication Tables (NextAuth.js)

- **Accounts**: OAuth provider accounts
- **Sessions**: User sessions
- **Verification Tokens**: Email verification

### Indexes

- `chat_message_user_id_idx`: Optimize user message queries
- `chat_message_conversation_id_idx`: Optimize conversation queries
- `chat_message_guest_session_id_idx`: Optimize guest session queries
- `user_quota_user_id_idx`: Optimize quota lookups

## 🔌 API Structure

### tRPC Routers

#### Chat Router (`/api/trpc/chat`)

```typescript
// Guest messaging
sendGuest: publicProcedure
  .input(
    z.object({
      message: z.string(),
      model: z.string(),
      conversationId: z.string(),
      guestSessionId: z.string(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    /* ... */
  });

// Authenticated messaging
send: protectedProcedure
  .input(
    z.object({
      message: z.string(),
      model: z.string(),
      conversationId: z.string(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    /* ... */
  });

// Get conversation history
getConversation: protectedProcedure
  .input(
    z.object({
      conversationId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    /* ... */
  });

// Get quota status
getQuotaStatus: protectedProcedure.query(async ({ ctx }) => {
  /* ... */
});
```

### Authentication Flow

```typescript
// NextAuth.js configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
  },
};
```

## 🧠 AI Model Integration

### OpenRouter Client

```typescript
export class OpenRouterClient {
  private baseUrl = "https://openrouter.ai/api/v1";
  private apiKey: string;

  async chat(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    const response = await this.makeRequest("/chat/completions", {
      method: "POST",
      body: JSON.stringify(request),
    });
    return response.json();
  }
}
```

### Supported Models

- **Free Tier**: Sarvam M, Dolphin Mistral, Gemma 3N, Hunyuan, DeepSeek, etc.
- **Premium Tier**: GPT-4, Claude-3 Sonnet, GPT-3.5 Turbo

### Context Management

```typescript
export function buildContext(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  limits: Partial<TokenLimits> = {}
): MessageContext {
  // Token estimation and message truncation
  // Rolling window management
  // Context preservation
}
```

## 🔐 Security Architecture

### Authentication & Authorization

- **OAuth 2.0**: Google OAuth integration
- **JWT Tokens**: Secure session management
- **CSRF Protection**: Built-in Next.js protection
- **Rate Limiting**: Per-user request limits

### Data Protection

- **Input Validation**: Zod schema validation
- **SQL Injection Prevention**: Drizzle ORM parameterized queries
- **XSS Protection**: React's built-in sanitization
- **Environment Variables**: Secure configuration management

### Privacy Features

- **Guest Sessions**: Temporary session IDs
- **Context Isolation**: Per-conversation boundaries
- **Data Encryption**: At-rest encryption (planned)

## 📱 Frontend Architecture

### Component Structure

```
src/components/
├── chat/
│   ├── chat-area.tsx          # Main chat interface
│   ├── chat-layout.tsx        # Layout wrapper
│   ├── model-selector.tsx     # AI model selection
│   ├── sidebar.tsx            # Navigation sidebar
│   ├── signin-modal.tsx       # Authentication modal
│   ├── project-context-panel.tsx  # Context management
│   └── mcp-servers-panel.tsx  # MCP server management
├── ui/                        # Reusable UI components
└── theme-provider.tsx         # Theme management
```

### State Management

- **React State**: Local component state
- **tRPC Queries**: Server state management
- **localStorage**: Guest session persistence
- **Context API**: Theme and global state

### Hooks

```typescript
// Custom hooks for functionality
useGuestMessageCount(); // Guest message tracking
useMobile(); // Mobile device detection
```

## 🚀 Performance Optimizations

### Frontend Optimizations

- **Next.js App Router**: Optimized routing and loading
- **React 19**: Concurrent rendering features
- **Code Splitting**: Dynamic imports for large components
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: Webpack bundle analyzer

### Backend Optimizations

- **Connection Pooling**: PostgreSQL connection management
- **Query Optimization**: Indexed database queries
- **Caching**: tRPC query caching
- **Rate Limiting**: Prevent abuse and ensure fair usage

### API Optimizations

- **Request Batching**: Multiple operations in single request
- **Response Compression**: Gzip compression
- **CDN Integration**: Static asset delivery
- **Error Handling**: Graceful error recovery

## 🔄 Data Flow

### Message Flow

1. **User Input**: User types message in chat interface
2. **Validation**: Input validated with Zod schemas
3. **Authentication**: Check user session or guest limits
4. **Rate Limiting**: Verify user within quota limits
5. **AI Processing**: Send to OpenRouter API
6. **Response Handling**: Process AI response
7. **Database Storage**: Store conversation in PostgreSQL
8. **UI Update**: Display response in chat interface

### Authentication Flow

1. **Guest Access**: User starts with guest session
2. **Message Limit**: After 3 messages, prompt for sign-in
3. **OAuth Flow**: Redirect to Google OAuth
4. **Session Creation**: Create authenticated session
5. **Data Migration**: Preserve guest messages (optional)
6. **Full Access**: Unlock unlimited features

## 🔧 Development Workflow

### Environment Setup

```bash
# Install dependencies
bun install

# Setup environment variables
cp .env.example .env

# Setup database
bun run db:push

# Start development server
bun run dev
```

### Database Management

```bash
# Generate migrations
bun run db:generate

# Push schema changes
bun run db:push

# Open database studio
bun run db:studio
```

### Code Quality

```bash
# Format and lint
bun run check

# Type checking
bun run typecheck

# Build project
bun run build
```

## 🚀 Deployment Architecture

### Vercel Deployment

- **Frontend**: Next.js app deployed to Vercel
- **API Routes**: Serverless functions
- **Database**: PostgreSQL on external provider
- **Environment**: Production environment variables

### Scaling Considerations

- **Serverless Functions**: Auto-scaling API endpoints
- **Database**: Connection pooling and read replicas
- **CDN**: Global content delivery
- **Monitoring**: Error tracking and performance monitoring

## 🔮 Future Architecture

### Planned Enhancements

- **MCP Implementation**: Model Context Protocol support
- **Microservices**: Service-oriented architecture
- **Event Streaming**: Real-time updates with WebSockets
- **Plugin System**: Extensible architecture
- **Multi-tenancy**: Team and organization support

### Scalability Roadmap

- **Horizontal Scaling**: Multiple server instances
- **Database Sharding**: Distributed data storage
- **Caching Layer**: Redis for session and data caching
- **Load Balancing**: Traffic distribution
- **Monitoring**: Comprehensive observability

---

_This architecture document is maintained alongside code changes and updated regularly._
