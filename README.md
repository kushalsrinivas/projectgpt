# ProjectGPT

A modern AI chat platform built with the T3 Stack that allows both authenticated and guest users to interact with multiple AI models.

## Features

### Guest Messaging

- **Free Trial**: Guest users can send up to 3 messages without signing up
- **Smart Limitation**: After 3 messages, users are prompted to sign in with Google
- **Message Preservation**: Draft messages are preserved during the sign-in flow
- **Seamless Transition**: Guest message count resets after authentication

### Authentication

- Google OAuth integration via NextAuth.js
- Automatic session management
- Post-sign-in message restoration

### AI Chat

- Multiple AI model support via OpenRouter
- Real-time messaging
- Message history for authenticated users
- Token usage tracking and rate limiting

## Tech Stack

This is a [T3 Stack](https://create.t3.gg/) project with additional features:

- [Next.js](https://nextjs.org) - React framework
- [NextAuth.js](https://next-auth.js.org) - Authentication with Google OAuth
- [Drizzle](https://orm.drizzle.team) - Database ORM
- [tRPC](https://trpc.io) - Type-safe API
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [PostgreSQL](https://postgresql.org) - Database
- [OpenRouter](https://openrouter.ai) - AI model access

## Setup

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/projectgpt"

# NextAuth.js
AUTH_SECRET="your-auth-secret-here"

# Google OAuth (required for guest sign-in feature)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenRouter API
OPENROUTER_API_KEY="your-openrouter-api-key"

# Environment
NODE_ENV="development"
```

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Add your domain to authorized origins
6. Add your callback URL: `http://localhost:3000/api/auth/callback/google`
7. Copy the Client ID and Client Secret to your `.env` file

### Database Setup

1. Set up a PostgreSQL database
2. Update the `DATABASE_URL` in your `.env` file
3. Run database migrations:
   ```bash
   bun run db:push
   ```

### Installation

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start the development server:

   ```bash
   bun run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Guest Messaging Implementation

The guest messaging feature implements the following flow:

1. **Guest Access**: Users can immediately start chatting without authentication
2. **Message Counting**: Each message increments a localStorage counter (`guestMsgCount`)
3. **Limit Enforcement**: After 3 messages, the sign-in modal appears
4. **Sign-in Flow**: Users authenticate via Google OAuth
5. **Message Restoration**: Draft messages are preserved and restored post-sign-in
6. **Counter Reset**: Guest message count is cleared after successful authentication

### Key Components

- `useGuestMessageCount`: Hook for managing localStorage-based message counting
- `SignInModal`: Modal component with Google OAuth integration
- `ChatArea`: Main chat interface supporting both guest and authenticated users
- `sendGuest`: tRPC procedure for handling guest messages

## Deployment

Follow the T3 Stack deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker).

Make sure to set all required environment variables in your deployment platform.

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), check out the [documentation](https://create.t3.gg/).
