"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Plus,
  Settings,
  History,
  X,
  Zap,
  Crown,
  Folder,
  FolderOpen,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { FolderManager } from "./folder-manager";
import { toast } from "sonner";

interface EnhancedSidebarProps {
  onClose: () => void;
  onConversationSelect: (conversationId: string) => void;
  selectedConversationId: string | null;
}

interface ConversationItem {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  model: string | null;
  folderId: number | null;
}

interface FolderItem {
  id: number;
  name: string;
  color: string;
  conversationCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}

export function EnhancedSidebar({
  onClose,
  onConversationSelect,
  selectedConversationId,
}: EnhancedSidebarProps) {
  const { data: session } = useSession();
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set()
  );
  const [viewMode, setViewMode] = useState<"all" | number>("all");
  const [draggedConversation, setDraggedConversation] = useState<string | null>(
    null
  );
  const [selectedConversations, setSelectedConversations] = useState<
    Set<string>
  >(new Set());

  // tRPC hooks
  const { data: conversations = [], refetch: refetchConversations } =
    api.chat.getConversations.useQuery(
      viewMode === "all" ? undefined : { folderId: viewMode },
      { enabled: !!session }
    );
  const { data: folders = [], refetch: refetchFolders } =
    api.folder.getAll.useQuery(undefined, { enabled: !!session });
  const { data: quotaStatus } = api.chat.getQuotaStatus.useQuery(undefined, {
    enabled: !!session,
  });

  const addConversationToFolder = api.folder.addConversation.useMutation();
  const removeConversationFromFolder =
    api.folder.removeConversation.useMutation();
  const moveConversations = api.folder.moveConversations.useMutation();

  const credits = quotaStatus?.remaining?.requests || 0;

  // Toggle folder expansion
  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Handle conversation selection
  const toggleConversationSelection = (
    conversationId: string,
    event: React.MouseEvent
  ) => {
    // If this is a simple click (no modifier keys), select the conversation for viewing
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
      onConversationSelect(conversationId);
      return;
    }

    // Handle multi-selection for drag-and-drop operations
    event.preventDefault();
    event.stopPropagation();

    const newSelected = new Set(selectedConversations);
    if (event.ctrlKey || event.metaKey) {
      if (newSelected.has(conversationId)) {
        newSelected.delete(conversationId);
      } else {
        newSelected.add(conversationId);
      }
    } else if (event.shiftKey && selectedConversations.size > 0) {
      // Implement shift-select logic here if needed
      newSelected.add(conversationId);
    } else {
      newSelected.clear();
      newSelected.add(conversationId);
    }

    setSelectedConversations(newSelected);
  };

  // Handle drag and drop
  const handleDragStart = (conversationId: string) => {
    setDraggedConversation(conversationId);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDropOnFolder = async (folderId: number) => {
    if (!draggedConversation) return;

    try {
      if (
        selectedConversations.size > 1 &&
        selectedConversations.has(draggedConversation)
      ) {
        // Move multiple conversations
        await moveConversations.mutateAsync({
          conversationIds: Array.from(selectedConversations),
          folderId,
        });
        toast.success(
          `Moved ${selectedConversations.size} conversations to folder`
        );
      } else {
        // Move single conversation
        await addConversationToFolder.mutateAsync({
          conversationId: draggedConversation,
          folderId,
        });
        toast.success("Conversation moved to folder");
      }

      setSelectedConversations(new Set());
      await refetchConversations();
      await refetchFolders();
    } catch (error) {
      toast.error("Failed to move conversation");
    } finally {
      setDraggedConversation(null);
    }
  };

  const handleDropOnAllChats = async () => {
    if (!draggedConversation) return;

    try {
      if (
        selectedConversations.size > 1 &&
        selectedConversations.has(draggedConversation)
      ) {
        // Remove multiple conversations from folders
        await Promise.all(
          Array.from(selectedConversations).map((id) =>
            removeConversationFromFolder.mutateAsync({ conversationId: id })
          )
        );
        toast.success(
          `Removed ${selectedConversations.size} conversations from folders`
        );
      } else {
        // Remove single conversation from folder
        await removeConversationFromFolder.mutateAsync({
          conversationId: draggedConversation,
        });
        toast.success("Conversation removed from folder");
      }

      setSelectedConversations(new Set());
      await refetchConversations();
      await refetchFolders();
    } catch (error) {
      toast.error("Failed to remove conversation from folder");
    } finally {
      setDraggedConversation(null);
    }
  };

  // Filter conversations by folder
  const filteredConversations = conversations.filter((conv) => {
    if (viewMode === "all") return true;
    return conv.folderId === viewMode;
  });

  // Group conversations by folder for display
  const conversationsByFolder = new Map<number | null, ConversationItem[]>();
  for (const conv of conversations) {
    const key = conv.folderId;
    if (!conversationsByFolder.has(key)) {
      conversationsByFolder.set(key, []);
    }
    const folderConversations = conversationsByFolder.get(key);
    if (folderConversations) {
      folderConversations.push(conv);
    }
  }

  if (!session) {
    return (
      <div className="flex h-full flex-col bg-sidebar">
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">
              ProjectGPT
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Sign in to access folder organization
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col bg-sidebar">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">
              ProjectGPT
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Credits & New Chat */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-100">
                Free Credits
              </span>
            </div>
            <Badge
              variant="secondary"
              className="bg-yellow-600/20 text-yellow-300 border-yellow-500/30"
            >
              {credits} left
            </Badge>
          </div>

          <Button className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        <Separator />

        {/* Folder Management */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-sidebar-foreground" />
              <span className="text-sm font-medium text-sidebar-foreground">
                Folders
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFolderManagerOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant={viewMode === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("all")}
              className="flex-1 justify-start"
              onDragOver={handleDragOver}
              onDrop={handleDropOnAllChats}
            >
              <Filter className="h-4 w-4 mr-2" />
              All Chats
              <Badge variant="secondary" className="ml-auto">
                {conversations.length}
              </Badge>
            </Button>
          </div>

          {/* Folders List */}
          <div className="space-y-1">
            {folders.map((folder) => (
              <div key={folder.id} className="space-y-1">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors w-full text-left",
                    viewMode === folder.id
                      ? "bg-sidebar-accent"
                      : "hover:bg-sidebar-accent/50"
                  )}
                  onClick={() => setViewMode(folder.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnFolder(folder.id)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(folder.id);
                    }}
                  >
                    {expandedFolders.has(folder.id) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>

                  <div
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: folder.color }}
                  />

                  <span className="text-sm font-medium text-sidebar-foreground flex-1 truncate">
                    {folder.name}
                  </span>

                  <Badge variant="secondary" className="text-xs">
                    {folder.conversationCount}
                  </Badge>
                </button>

                {/* Folder conversations (when expanded) */}
                {expandedFolders.has(folder.id) && (
                  <div className="ml-6 space-y-1">
                    {(conversationsByFolder.get(folder.id) || []).map(
                      (conversation) => (
                        <ConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          isSelected={selectedConversations.has(
                            conversation.id
                          )}
                          onSelect={toggleConversationSelection}
                          onDragStart={handleDragStart}
                          folderColor={folder.color}
                          isCurrentConversation={
                            selectedConversationId === conversation.id
                          }
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Conversations */}
        <div className="flex-1 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-sidebar-foreground" />
              <span className="text-sm font-medium text-sidebar-foreground">
                {viewMode === "all"
                  ? "All Conversations"
                  : "Folder Conversations"}
              </span>
              {viewMode !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("all")}
                  className="ml-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-2">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-sm">Start a new chat to get started</p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversations.has(conversation.id)}
                    onSelect={toggleConversationSelection}
                    onDragStart={handleDragStart}
                    folderColor={
                      conversation.folderId
                        ? folders.find((f) => f.id === conversation.folderId)
                            ?.color
                        : undefined
                    }
                    isCurrentConversation={
                      selectedConversationId === conversation.id
                    }
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Settings */}
        <div className="p-4">
          <Button variant="ghost" className="w-full justify-start" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start mt-2"
            size="sm"
          >
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Pro
          </Button>
        </div>
      </div>

      {/* Folder Manager Dialog */}
      <FolderManager
        open={folderManagerOpen}
        onOpenChange={setFolderManagerOpen}
      />
    </>
  );
}

// Conversation Item Component
interface ConversationItemProps {
  conversation: ConversationItem;
  isSelected: boolean;
  onSelect: (conversationId: string, event: React.MouseEvent) => void;
  onDragStart: (conversationId: string) => void;
  folderColor?: string;
  isCurrentConversation?: boolean;
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDragStart,
  folderColor,
  isCurrentConversation,
}: ConversationItemProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { data: folders = [] } = api.folder.getAll.useQuery();
  const addConversationToFolder = api.folder.addConversation.useMutation();
  const removeConversationFromFolder =
    api.folder.removeConversation.useMutation();

  const handleMoveToFolder = async (folderId: number) => {
    try {
      await addConversationToFolder.mutateAsync({
        conversationId: conversation.id,
        folderId,
      });
      toast.success("Conversation moved to folder");
    } catch (error) {
      toast.error("Failed to move conversation");
    }
  };

  const handleRemoveFromFolder = async () => {
    try {
      await removeConversationFromFolder.mutateAsync({
        conversationId: conversation.id,
      });
      toast.success("Conversation removed from folder");
    } catch (error) {
      toast.error("Failed to remove conversation from folder");
    }
  };

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-lg p-3 transition-colors relative",
        isCurrentConversation
          ? "bg-primary/10 border border-primary/20"
          : isSelected
          ? "bg-primary/20 border border-primary/30"
          : "hover:bg-sidebar-accent",
        folderColor && "border-l-4"
      )}
      style={folderColor ? { borderLeftColor: folderColor } : undefined}
      draggable
      onDragStart={() => onDragStart(conversation.id)}
      onClick={(e) => onSelect(conversation.id, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(conversation.id, e as any);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {conversation.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {conversation.model && (
              <Badge variant="outline" className="text-xs">
                {conversation.model}
              </Badge>
            )}
            <span className="text-xs text-sidebar-foreground/60">
              {conversation.lastMessageTime.toLocaleDateString()}
            </span>
          </div>
        </div>

        <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                // Handle rename or other actions
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {folders.map((folder) => (
              <DropdownMenuItem
                key={folder.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveToFolder(folder.id);
                }}
              >
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: folder.color }}
                />
                Move to {folder.name}
              </DropdownMenuItem>
            ))}
            {conversation.folderId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFromFolder();
                  }}
                >
                  Remove from folder
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-xs text-sidebar-foreground/60 mt-2 truncate">
        {conversation.lastMessage}
      </p>
    </div>
  );
}
