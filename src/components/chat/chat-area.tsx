"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Play,
  Zap,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SignInModal } from "./signin-modal";
import { useGuestMessageCount } from "@/hooks/use-guest-message-count";

interface ChatAreaProps {
  selectedModel: string;
  selectedConversationId: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
}

export function ChatArea({
  selectedModel,
  selectedConversationId,
}: ChatAreaProps) {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(() =>
    crypto.randomUUID()
  );
  const [guestSessionId] = useState(() => crypto.randomUUID());
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    tier: "free" | "pro";
    resetTime: Date;
  } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Guest message count hook
  const {
    guestMessageCount,
    incrementGuestMessageCount,
    resetGuestMessageCount,
    hasReachedLimit,
    remainingMessages,
    isClient,
  } = useGuestMessageCount();

  // tRPC hooks for authenticated users (keeping for quota status and other features)
  const quotaStatus = api.chat.getQuotaStatus.useQuery(undefined, {
    enabled: !!session,
  });
  const watchAd = api.chat.watchAd.useMutation();
  const { data: conversation } = api.chat.getConversation.useQuery(
    { conversationId },
    { enabled: !!session }
  );

  // Handle conversation selection changes
  useEffect(() => {
    if (selectedConversationId) {
      setConversationId(selectedConversationId);
      setMessages([]); // Clear current messages while loading
    }
  }, [selectedConversationId]);

  // Load conversation messages for authenticated users
  useEffect(() => {
    if (conversation && session) {
      const formattedMessages: Message[] = conversation.map((msg) => ({
        id: String(msg.id),
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.createdAt),
        model: msg.model || undefined,
      }));
      setMessages(formattedMessages);
    }
  }, [conversation, session]);

  // Reset guest message count when user signs in and restore draft message
  useEffect(() => {
    if (session && isClient) {
      resetGuestMessageCount();

      // Restore draft message if it exists
      const draftMessage = sessionStorage.getItem("draftMessage");
      if (draftMessage) {
        setInput(draftMessage);
        sessionStorage.removeItem("draftMessage");
        // Focus the textarea after a short delay
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    }
  }, [session, isClient, resetGuestMessageCount]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  });

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Check if guest has reached the limit
    if (!session && hasReachedLimit) {
      setShowSignInModal(true);
      setIsStreaming(false);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
          model: selectedModel,
          conversationId,
          guestSessionId: !session ? guestSessionId : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to send message");
      }

      const result = await response.json();

      // Create assistant message with complete response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.message,
        timestamp: new Date(),
        model: result.model,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Increment guest message count for guests
      if (!session) {
        incrementGuestMessageCount();
      } else {
        // Refetch quota status for authenticated users
        quotaStatus.refetch();
      }
    } catch (error) {
      console.error("Send message error:", error);

      // Handle rate limit errors
      if (
        error instanceof Error &&
        (error.message?.includes("quota") ||
          error.message?.includes("rate") ||
          error.message?.includes("429"))
      ) {
        setRateLimitInfo({
          tier: "free",
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        setShowRateLimitDialog(true);
      }

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${
          error instanceof Error ? error.message : "Please try again."
        }`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleWatchAd = async () => {
    try {
      await watchAd.mutateAsync();
      setShowRateLimitDialog(false);
      quotaStatus.refetch();
    } catch (error) {
      console.error("Watch ad error:", error);
    }
  };

  const handleUpgrade = () => {
    alert("Upgrade functionality will be implemented here!");
  };

  const quota = quotaStatus.data;
  const isLoading = isStreaming;

  // Show loading state while session is loading
  if (status === "loading") {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-spin">
          <RefreshCw className="h-8 w-8" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sign-in modal for guests */}
      <SignInModal
        open={showSignInModal}
        onOpenChange={setShowSignInModal}
        draftMessage={input}
      />

      {/* Rate limit dialog for authenticated users */}
      {session && (
        <Dialog
          open={showRateLimitDialog}
          onOpenChange={setShowRateLimitDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Daily Quota Reached
              </DialogTitle>
              <DialogDescription>
                You've used up your free chat quota for today. Your quota will
                reset at {rateLimitInfo?.resetTime.toLocaleString()}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 mt-4">
              <Button
                onClick={handleWatchAd}
                disabled={watchAd.isPending}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {watchAd.isPending
                  ? "Loading..."
                  : "Watch 30s Ad for 10 More Chats"}
              </Button>

              <Button
                variant="outline"
                onClick={handleUpgrade}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                Upgrade to Pro for Unlimited Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Messages area - scrollable */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="p-4">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="p-4 rounded-lg bg-muted/50 max-w-md">
                    <h3 className="font-semibold mb-2">
                      Welcome to ProjectGPT!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      I'm your AI assistant. I can help you with coding,
                      writing, analysis, and more. What would you like to work
                      on today?
                    </p>
                    {!session && isClient && (
                      <p className="text-xs text-muted-foreground mt-2">
                        You have {remainingMessages} free messages remaining.
                        Sign in for unlimited access.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-4",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-12"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "assistant" && message.model && (
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {message.model}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    )}

                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans">
                        {message.content}
                      </pre>
                    </div>

                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyMessage(message.content)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback>
                        {session ? session.user?.name?.charAt(0) || "U" : "G"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin">
                        <RefreshCw className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {selectedModel} is thinking...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Input area - fixed at bottom */}
      <div className="shrink-0 border-t bg-background">
        <div className="p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                  className="min-h-[60px] max-h-[200px] resize-none"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="lg"
              >
                {isStreaming ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Using {selectedModel}</span>
              <div className="flex items-center gap-4">
                <span>Press Enter to send • Shift+Enter for new line</span>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  <span>
                    {session
                      ? quota?.tier === "free"
                        ? `${quota.remaining.requests} requests remaining`
                        : "Unlimited"
                      : isClient &&
                        `${remainingMessages} free messages remaining`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
