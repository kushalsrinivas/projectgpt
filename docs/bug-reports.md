# Bug Reports & Issue Tracking

## ProjectGPT - AI Chat Platform

**Version:** 1.0.0  
**Last Updated:** January 2025

---

## 🐛 Bug Report Template

### Issue Title Format

```
[SEVERITY] [COMPONENT] Brief description of the issue
```

**Examples:**

- `[HIGH] [AUTH] Google OAuth callback fails with 400 error`
- `[MEDIUM] [CHAT] Messages not displaying in correct order`
- `[LOW] [UI] Dark mode toggle animation glitches`

### Bug Report Form

```markdown
## Bug Description

**Brief Summary:**
[Provide a clear, concise description of the bug]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

## Reproduction Steps

1. [First step]
2. [Second step]
3. [Third step]
4. [Error occurs]

## Environment Information

- **Browser:** [Chrome 120.0.0, Firefox 121.0, Safari 17.0]
- **OS:** [macOS 14.2, Windows 11, Ubuntu 22.04]
- **Device:** [Desktop, Mobile, Tablet]
- **Screen Resolution:** [1920x1080, 375x667, etc.]
- **User Type:** [Guest, Authenticated, Admin]

## Technical Details

- **URL:** [Where the bug occurred]
- **User Agent:** [Browser user agent string]
- **Session ID:** [If applicable]
- **Conversation ID:** [If chat-related]
- **Selected Model:** [If AI model-related]

## Error Messages
```

[Paste any error messages, console logs, or stack traces]

```

## Screenshots/Videos
[Attach screenshots or screen recordings if applicable]

## Additional Context
- **Frequency:** [Always, Sometimes, Rarely]
- **Impact:** [Blocks functionality, Causes confusion, Minor annoyance]
- **Workaround:** [Any temporary solutions found]
- **Related Issues:** [Link to related bugs or features]

## Severity Classification
- [ ] **Critical** - System down, data loss, security breach
- [ ] **High** - Major functionality broken, affects many users
- [ ] **Medium** - Minor functionality issues, affects some users
- [ ] **Low** - Cosmetic issues, minor inconveniences
```

## 🔍 Issue Investigation Guide

### Initial Triage Checklist

- [ ] **Reproducible**: Can the issue be consistently reproduced?
- [ ] **Environment**: Does it occur in specific browsers/devices?
- [ ] **User Impact**: How many users are affected?
- [ ] **Data Integrity**: Is user data at risk?
- [ ] **Security**: Are there security implications?
- [ ] **Workaround**: Is there a temporary solution?

### Investigation Steps

#### 1. Reproduce the Issue

```bash
# Try to reproduce in development
bun run dev

# Check different environments
# - Local development
# - Preview deployment
# - Production environment
```

#### 2. Check Logs

```bash
# Application logs
tail -f /var/log/projectgpt/app.log

# Database logs
tail -f /var/log/postgresql/postgresql.log

# Vercel function logs
vercel logs --app projectgpt
```

#### 3. Database Investigation

```sql
-- Check for data inconsistencies
SELECT * FROM projectgpt_chat_message
WHERE userId IS NULL AND guestSessionId IS NULL;

-- Check for failed operations
SELECT * FROM projectgpt_user_quota
WHERE requestsUsed < 0 OR tokensUsed < 0;

-- Check recent error patterns
SELECT model, COUNT(*) as error_count
FROM projectgpt_chat_message
WHERE content LIKE '%error%'
AND createdAt > NOW() - INTERVAL '24 hours'
GROUP BY model;
```

#### 4. Performance Analysis

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s "https://projectgpt.dev/api/trpc/chat.send"

# Monitor database performance
EXPLAIN ANALYZE SELECT * FROM projectgpt_chat_message
WHERE userId = 'user-id' ORDER BY createdAt DESC LIMIT 10;
```

## 🚨 Common Issues & Solutions

### Authentication Issues

#### Google OAuth Callback Error

**Symptoms:**

- 400 error on OAuth callback
- "Invalid redirect URI" message
- Users stuck on sign-in page

**Investigation:**

```typescript
// Check OAuth configuration
console.log("OAuth Config:", {
  clientId: env.AUTH_GOOGLE_ID,
  redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
});
```

**Solutions:**

1. Verify redirect URI in Google Console
2. Check NEXTAUTH_URL environment variable
3. Ensure HTTPS in production

#### Session Persistence Issues

**Symptoms:**

- Users logged out unexpectedly
- Session data not persisting
- "Unauthorized" errors for authenticated users

**Investigation:**

```sql
-- Check session table
SELECT * FROM projectgpt_session
WHERE expires > NOW()
ORDER BY expires DESC;
```

**Solutions:**

1. Check AUTH_SECRET environment variable
2. Verify database connection
3. Clear browser cookies and retry

### Chat Functionality Issues

#### Messages Not Sending

**Symptoms:**

- Loading spinner never stops
- Messages don't appear in chat
- Network errors in console

**Investigation:**

```typescript
// Add debugging to chat mutation
const sendMessage = api.chat.send.useMutation({
  onError: (error) => {
    console.error("Send message error:", error);
    console.error("Error details:", {
      code: error.data?.code,
      message: error.message,
      stack: error.stack,
    });
  },
});
```

**Solutions:**

1. Check OpenRouter API key
2. Verify rate limiting settings
3. Check database connection
4. Validate input schemas

#### AI Model Responses Delayed

**Symptoms:**

- Very slow response times (>30 seconds)
- Timeout errors
- Inconsistent response times

**Investigation:**

```typescript
// Add timing to OpenRouter client
async chat(request: OpenRouterRequest) {
  const startTime = Date.now();
  try {
    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    console.log(`OpenRouter response time: ${Date.now() - startTime}ms`);
    return response;
  } catch (error) {
    console.error(`OpenRouter error after ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}
```

**Solutions:**

1. Check OpenRouter service status
2. Implement request timeout
3. Add retry logic
4. Use fallback models

### Database Issues

#### Connection Pool Exhaustion

**Symptoms:**

- "Connection pool exhausted" errors
- Slow database queries
- Application timeouts

**Investigation:**

```sql
-- Check active connections
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

-- Check long-running queries
SELECT query, state, query_start
FROM pg_stat_activity
WHERE state != 'idle'
AND query_start < NOW() - INTERVAL '5 minutes';
```

**Solutions:**

1. Increase connection pool size
2. Add connection timeout
3. Optimize slow queries
4. Add connection monitoring

#### Data Integrity Issues

**Symptoms:**

- Orphaned records
- Missing foreign key relationships
- Inconsistent data states

**Investigation:**

```sql
-- Check for orphaned messages
SELECT cm.id, cm.userId, cm.conversationId
FROM projectgpt_chat_message cm
LEFT JOIN projectgpt_user u ON cm.userId = u.id
WHERE cm.userId IS NOT NULL AND u.id IS NULL;

-- Check quota inconsistencies
SELECT u.id, u.email, uq.requestsUsed, uq.tokensUsed
FROM projectgpt_user u
LEFT JOIN projectgpt_user_quota uq ON u.id = uq.userId
WHERE uq.userId IS NULL;
```

**Solutions:**

1. Add database constraints
2. Implement data validation
3. Create cleanup scripts
4. Add monitoring queries

### Performance Issues

#### Slow Page Load Times

**Symptoms:**

- Pages take >5 seconds to load
- White screen during loading
- Poor Core Web Vitals scores

**Investigation:**

```bash
# Analyze bundle size
npx @next/bundle-analyzer

# Check Lighthouse scores
lighthouse https://projectgpt.dev --output html

# Monitor Core Web Vitals
curl -H "User-Agent: Mozilla/5.0..." https://projectgpt.dev
```

**Solutions:**

1. Optimize bundle size
2. Implement code splitting
3. Add loading states
4. Optimize images and assets

#### Memory Leaks

**Symptoms:**

- Increasing memory usage over time
- Browser becomes unresponsive
- Application crashes

**Investigation:**

```typescript
// Add memory monitoring
if (typeof window !== "undefined") {
  setInterval(() => {
    const memory = (performance as any).memory;
    if (memory) {
      console.log("Memory usage:", {
        used: Math.round(memory.usedJSHeapSize / 1048576),
        total: Math.round(memory.totalJSHeapSize / 1048576),
        limit: Math.round(memory.jsHeapSizeLimit / 1048576),
      });
    }
  }, 30000);
}
```

**Solutions:**

1. Fix event listener cleanup
2. Remove unused dependencies
3. Optimize component re-renders
4. Add memory profiling

## 🛠️ Debugging Tools

### Browser Developer Tools

```javascript
// Enable debug mode
localStorage.setItem("debug", "projectgpt:*");

// Monitor network requests
// Network tab -> Filter by "trpc"

// Check console for errors
// Console tab -> Filter by "error"

// Inspect React components
// React DevTools -> Components tab
```

### Database Debugging

```sql
-- Enable query logging
SET log_statement = 'all';

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Monitor locks
SELECT * FROM pg_locks
WHERE NOT granted;
```

### API Debugging

```typescript
// Add request/response logging
export const appRouter = createTRPCRouter({
  // ... routers
}).createCaller({
  // Add logging middleware
  onRequest: ({ req, res, next }) => {
    console.log("Request:", req.method, req.url);
    return next();
  },
  onResponse: ({ req, res, next }) => {
    console.log("Response:", res.statusCode);
    return next();
  },
});
```

## 📊 Monitoring & Alerting

### Error Tracking

```typescript
// Sentry integration
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter out known issues
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value?.includes("Non-Error promise rejection")) {
        return null;
      }
    }
    return event;
  },
});
```

### Performance Monitoring

```typescript
// Add performance metrics
export function reportWebVitals(metric: any) {
  console.log("Web Vitals:", metric);

  // Send to analytics
  if (process.env.NODE_ENV === "production") {
    gtag("event", metric.name, {
      event_category: "Web Vitals",
      event_label: metric.id,
      value: Math.round(metric.value),
      non_interaction: true,
    });
  }
}
```

### Health Checks

```typescript
// API health check endpoint
export async function GET() {
  try {
    // Check database connection
    await db.select().from(users).limit(1);

    // Check external services
    const openRouterHealth = await fetch("https://openrouter.ai/api/v1/models");

    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "up",
        openrouter: openRouterHealth.ok ? "up" : "down",
      },
    });
  } catch (error) {
    return Response.json(
      {
        status: "unhealthy",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

## 📋 Issue Resolution Workflow

### 1. Triage (Within 2 hours)

- [ ] Assign severity level
- [ ] Identify affected components
- [ ] Estimate user impact
- [ ] Assign to appropriate team member

### 2. Investigation (Within 24 hours)

- [ ] Reproduce the issue
- [ ] Identify root cause
- [ ] Document findings
- [ ] Estimate fix complexity

### 3. Resolution (Based on severity)

- **Critical**: Within 4 hours
- **High**: Within 24 hours
- **Medium**: Within 1 week
- **Low**: Next sprint

### 4. Testing & Deployment

- [ ] Implement fix
- [ ] Write/update tests
- [ ] Code review
- [ ] Deploy to staging
- [ ] Verify fix works
- [ ] Deploy to production

### 5. Follow-up

- [ ] Monitor for regressions
- [ ] Update documentation
- [ ] Conduct post-mortem (if critical)
- [ ] Implement preventive measures

## 📝 Post-Mortem Template

```markdown
# Post-Mortem: [Issue Title]

## Incident Summary

- **Date:** [YYYY-MM-DD]
- **Duration:** [X hours/minutes]
- **Impact:** [Number of users affected]
- **Severity:** [Critical/High/Medium/Low]

## Timeline

- **[Time]** - Issue first reported
- **[Time]** - Investigation began
- **[Time]** - Root cause identified
- **[Time]** - Fix implemented
- **[Time]** - Issue resolved

## Root Cause Analysis

### What happened?

[Detailed explanation of the issue]

### Why did it happen?

[Technical root cause]

### Why wasn't it caught earlier?

[Process/testing gaps]

## Resolution

### Immediate Fix

[What was done to resolve the issue]

### Preventive Measures

- [ ] [Action item 1]
- [ ] [Action item 2]
- [ ] [Action item 3]

## Lessons Learned

- [Key takeaway 1]
- [Key takeaway 2]
- [Key takeaway 3]

## Action Items

- [ ] [Improvement 1] - Assigned to [Person] - Due [Date]
- [ ] [Improvement 2] - Assigned to [Person] - Due [Date]
- [ ] [Improvement 3] - Assigned to [Person] - Due [Date]
```

---

_This bug report guide is updated regularly based on new issues and resolution patterns._
