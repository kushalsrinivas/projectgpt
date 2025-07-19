"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  Folder,
  MessageSquare,
  FileText,
  Plus,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface FolderViewProps {
  folderId: number;
  selectedModel: string;
  onNewChatFromFolder: (conversationId?: string) => void;
}

interface FolderInfo {
  id: number;
  name: string;
  color: string;
  conversationCount: number;
}

interface ConversationItem {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  model: string | null;
}

export function FolderView({
  folderId,
  selectedModel,
  onNewChatFromFolder,
}: FolderViewProps) {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // tRPC hooks
  const { data: folders = [] } = api.folder.getAll.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: folderConversations = [] } =
    api.folder.getConversations.useQuery({ folderId }, { enabled: !!session });

  const currentFolder = folders.find((f) => f.id === folderId);

  // tRPC mutations
  const addConversationToFolder = api.folder.addConversation.useMutation();

  const handleStartNewChat = async () => {
    if (!input.trim()) return;

    setIsCreatingChat(true);

    try {
      // Create a new conversation ID
      const newConversationId = crypto.randomUUID();

      // Send the first message
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
          model: selectedModel,
          conversationId: newConversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // Add the conversation to the current folder using tRPC
      await addConversationToFolder.mutateAsync({
        conversationId: newConversationId,
        folderId,
      });

      toast.success("New chat started in folder");
      setInput("");

      // Switch to the new conversation in normal chat view
      onNewChatFromFolder(newConversationId);
    } catch (error) {
      toast.error("Failed to start new chat");
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleStartNewChat();
    }
  };

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  if (!currentFolder) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Folder not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Folder Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: currentFolder.color }}
          >
            <Folder className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{currentFolder.name}</h2>
            <p className="text-sm text-muted-foreground">
              {folderConversations.length} conversation
              {folderConversations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Input */}
      <div className="border-b bg-background p-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Start a new conversation in ${currentFolder.name}...`}
              className="min-h-[44px] max-h-32 resize-none"
              disabled={isCreatingChat}
            />
          </div>
          <Button
            onClick={handleStartNewChat}
            disabled={!input.trim() || isCreatingChat}
            size="sm"
            className="h-[44px] px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs for Resources and Conversations */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="conversations" className="h-full flex flex-col">
          <div className="border-b bg-background px-4 py-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="resources"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Resources
              </TabsTrigger>
              <TabsTrigger
                value="conversations"
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Conversations
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resources" className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No resources yet</p>
                  <p className="text-xs">
                    Upload files and documents to organize your project context
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="conversations" className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {folderConversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs">
                      Start a new conversation above to get started
                    </p>
                  </div>
                ) : (
                  folderConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      className="w-full rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                      onClick={() => {
                        // Handle conversation selection
                        // This would switch to normal chat view with this conversation
                        onNewChatFromFolder(conversation.id);
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {conversation.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conversation.lastMessage}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground ml-2">
                          {new Date(
                            conversation.lastMessageTime
                          ).toLocaleDateString()}
                        </div>
                      </div>
                      {conversation.model && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {conversation.model}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
