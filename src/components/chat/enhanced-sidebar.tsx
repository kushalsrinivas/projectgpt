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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Edit3,
  Trash2,
  Move,
  Archive,
  List,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { FolderManager } from "./folder-manager";
import { toast } from "sonner";
import { localFirstTRPC } from "@/lib/local-first-trpc";
import { SyncStatusComponent } from "@/components/sync-status";

interface EnhancedSidebarProps {
  onClose: () => void;
  onConversationSelect: (conversationId: string) => void;
  selectedConversationId: string | null;
  onNewChat: () => void;
  onFolderSelect: (folderId: number) => void;
  selectedFolderId: number | null;
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

type ViewTab = "all" | "organized";

export function EnhancedSidebar({
  onClose,
  onConversationSelect,
  selectedConversationId,
  onNewChat,
  onFolderSelect,
  selectedFolderId,
}: EnhancedSidebarProps) {
  const { data: session } = useSession();
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set()
  );
  const [viewTab, setViewTab] = useState<ViewTab>("all");
  const [draggedConversation, setDraggedConversation] = useState<string | null>(
    null
  );
  const [selectedConversations, setSelectedConversations] = useState<
    Set<string>
  >(new Set());

  // tRPC hooks
  const { data: conversations = [], refetch: refetchConversations } =
    api.chat.getConversations.useQuery(undefined, { enabled: !!session });
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

  // Group conversations by folder for organized view
  const conversationsByFolder = new Map<number | null, ConversationItem[]>();
  const uncategorizedConversations: ConversationItem[] = [];

  for (const conv of conversations) {
    if (conv.folderId === null) {
      uncategorizedConversations.push(conv);
    } else {
      if (!conversationsByFolder.has(conv.folderId)) {
        conversationsByFolder.set(conv.folderId, []);
      }
      conversationsByFolder.get(conv.folderId)?.push(conv);
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

          <Button className="w-full" size="sm" onClick={onNewChat}>
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        <Separator />

        {/* Tab System for Chat Organization */}
        <div className="flex-1 overflow-hidden">
          <Tabs
            value={viewTab}
            onValueChange={(value) => setViewTab(value as ViewTab)}
            className="h-full flex flex-col"
          >
            <div className="p-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-sidebar-foreground" />
                  <span className="text-sm font-medium text-sidebar-foreground">
                    Chat Organization
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

              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all" className="text-xs">
                  <List className="h-3 w-3 mr-1" />
                  All Conversations
                </TabsTrigger>
                <TabsTrigger value="organized" className="text-xs">
                  <Layers className="h-3 w-3 mr-1" />
                  Organized View
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="flex-1 overflow-hidden m-0 p-0">
              <div className="px-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-sidebar-foreground">
                    All Conversations
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {conversations.length}
                  </Badge>
                </div>
              </div>

              <ScrollArea className="flex-1 px-4">
                <div className="space-y-1">
                  {conversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No conversations yet</p>
                      <p className="text-xs">Start a new chat to get started</p>
                    </div>
                  ) : (
                    conversations.map((conversation) => (
                      <CompactConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isSelected={selectedConversations.has(conversation.id)}
                        onSelect={toggleConversationSelection}
                        onDragStart={handleDragStart}
                        folderColor={
                          conversation.folderId
                            ? folders.find(
                                (f) => f.id === conversation.folderId
                              )?.color
                            : undefined
                        }
                        isCurrentConversation={
                          selectedConversationId === conversation.id
                        }
                        folders={folders}
                        onRefetch={() => {
                          refetchConversations();
                          refetchFolders();
                        }}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="organized"
              className="flex-1 overflow-hidden m-0 p-0"
            >
              <div className="px-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-sidebar-foreground">
                    Organized by Folders
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {folders.length} folders
                  </Badge>
                </div>
              </div>

              <ScrollArea className="flex-1 px-4">
                <div className="space-y-2">
                  {/* Folders with conversations */}
                  {folders.map((folder) => {
                    const folderConversations =
                      conversationsByFolder.get(folder.id) || [];
                    return (
                      <div key={folder.id} className="space-y-1">
                        <div
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg transition-colors",
                            selectedFolderId === folder.id
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-sidebar-accent/50"
                          )}
                        >
                          <button
                            type="button"
                            className="p-0 hover:bg-sidebar-accent rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFolder(folder.id);
                            }}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDropOnFolder(folder.id)}
                          >
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 transition-transform",
                                expandedFolders.has(folder.id) && "rotate-90"
                              )}
                            />
                          </button>

                          <button
                            type="button"
                            className="flex items-center gap-2 flex-1 text-left"
                            onClick={() => onFolderSelect(folder.id)}
                          >
                            <div
                              className="w-3 h-3 rounded-full border border-white/20"
                              style={{ backgroundColor: folder.color }}
                            />

                            <span className="text-sm font-medium text-sidebar-foreground flex-1 truncate">
                              {folder.name}
                            </span>

                            <Badge variant="secondary" className="text-xs">
                              {folderConversations.length}
                            </Badge>
                          </button>
                        </div>

                        {/* Folder conversations (when expanded) */}
                        {expandedFolders.has(folder.id) && (
                          <div className="ml-6 space-y-1">
                            {folderConversations.map((conversation) => (
                              <CompactConversationItem
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
                                folders={folders}
                                onRefetch={() => {
                                  refetchConversations();
                                  refetchFolders();
                                }}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Uncategorized conversations */}
                  {uncategorizedConversations.length > 0 && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors w-full text-left hover:bg-sidebar-accent/50"
                        onClick={() => toggleFolder(-1)} // Use -1 for uncategorized
                        onDragOver={handleDragOver}
                        onDrop={handleDropOnAllChats}
                      >
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform",
                            expandedFolders.has(-1) && "rotate-90"
                          )}
                        />

                        <Filter className="h-3 w-3 text-muted-foreground" />

                        <span className="text-sm font-medium text-sidebar-foreground flex-1 truncate">
                          Uncategorized
                        </span>

                        <Badge variant="secondary" className="text-xs">
                          {uncategorizedConversations.length}
                        </Badge>
                      </button>

                      {expandedFolders.has(-1) && (
                        <div className="ml-6 space-y-1">
                          {uncategorizedConversations.map((conversation) => (
                            <CompactConversationItem
                              key={conversation.id}
                              conversation={conversation}
                              isSelected={selectedConversations.has(
                                conversation.id
                              )}
                              onSelect={toggleConversationSelection}
                              onDragStart={handleDragStart}
                              isCurrentConversation={
                                selectedConversationId === conversation.id
                              }
                              folders={folders}
                              onRefetch={() => {
                                refetchConversations();
                                refetchFolders();
                              }}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {folders.length === 0 &&
                    uncategorizedConversations.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No organized conversations</p>
                        <p className="text-xs">
                          Create folders to organize your chats
                        </p>
                      </div>
                    )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <Separator />

        {/* Sync Status */}
        <div className="p-4">
          <SyncStatusComponent compact />
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

// Compact Conversation Item Component with improved design
interface CompactConversationItemProps {
  conversation: ConversationItem;
  isSelected: boolean;
  onSelect: (conversationId: string, event: React.MouseEvent) => void;
  onDragStart: (conversationId: string) => void;
  folderColor?: string;
  isCurrentConversation?: boolean;
  folders: FolderItem[];
  onRefetch: () => void;
  compact?: boolean;
}

function CompactConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDragStart,
  folderColor,
  isCurrentConversation,
  folders,
  onRefetch,
  compact = false,
}: CompactConversationItemProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(conversation.title);

  const addConversationToFolder = api.folder.addConversation.useMutation();
  const removeConversationFromFolder =
    api.folder.removeConversation.useMutation();
  const renameConversation = api.chat.renameConversation.useMutation();
  const deleteConversation = api.chat.deleteConversation.useMutation();

  const handleMoveToFolder = async (folderId: number) => {
    try {
      await addConversationToFolder.mutateAsync({
        conversationId: conversation.id,
        folderId,
      });
      toast.success("Conversation moved to folder");
      onRefetch();
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
      onRefetch();
    } catch (error) {
      toast.error("Failed to remove conversation from folder");
    }
  };

  const handleRename = () => {
    setIsRenaming(true);
    setShowDropdown(false);
  };

  const handleSaveRename = async () => {
    if (!newTitle.trim() || newTitle.trim() === conversation.title) {
      setIsRenaming(false);
      setNewTitle(conversation.title);
      return;
    }

    // Optimistic update - immediately show the new title
    setIsRenaming(false);
    const originalTitle = conversation.title;

    try {
      // Use optimistic update with tRPC mutation
      await renameConversation.mutateAsync({
        conversationId: conversation.id,
        title: newTitle.trim(),
      });
      toast.success("Conversation renamed successfully");
      // Refetch to ensure consistency
      onRefetch();
    } catch (error) {
      // Revert on error
      setNewTitle(originalTitle);
      toast.error("Failed to rename conversation");
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this conversation? This action cannot be undone."
      )
    ) {
      try {
        await deleteConversation.mutateAsync({
          conversationId: conversation.id,
        });
        toast.success("Conversation deleted successfully");
        onRefetch();
        setShowDropdown(false);
      } catch (error) {
        toast.error("Failed to delete conversation");
      }
    }
    setShowDropdown(false);
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg transition-all duration-200",
        isCurrentConversation
          ? "bg-primary/10 border border-primary/20"
          : isSelected
          ? "bg-primary/20 border border-primary/30"
          : "hover:bg-sidebar-accent/50",
        folderColor && !compact && "border-l-2",
        compact ? "py-1" : "py-2"
      )}
      style={
        folderColor && !compact ? { borderLeftColor: folderColor } : undefined
      }
    >
      <button
        type="button"
        className="w-full text-left p-2 cursor-pointer"
        draggable
        onDragStart={() => onDragStart(conversation.id)}
        onClick={(e) => onSelect(conversation.id, e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveRename();
                  }
                  if (e.key === "Escape") {
                    setNewTitle(conversation.title);
                    setIsRenaming(false);
                  }
                }}
                onBlur={handleSaveRename}
                className="w-full bg-transparent border-none outline-none text-sm font-medium text-sidebar-foreground"
              />
            ) : (
              <p
                className={cn(
                  "font-medium text-sidebar-foreground truncate",
                  compact ? "text-xs" : "text-sm"
                )}
              >
                {conversation.title}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1">
              {conversation.model && (
                <Badge
                  variant="outline"
                  className={cn(compact ? "text-[10px] px-1 py-0" : "text-xs")}
                >
                  {conversation.model}
                </Badge>
              )}
              {folderColor && compact && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: folderColor }}
                />
              )}
              <span
                className={cn(
                  "text-sidebar-foreground/60",
                  compact ? "text-[10px]" : "text-xs"
                )}
              >
                {conversation.lastMessageTime.toLocaleDateString()}
              </span>
            </div>
          </div>

          <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  compact ? "h-6 w-6 p-0" : ""
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal
                  className={cn(compact ? "h-3 w-3" : "h-4 w-4")}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRename}>
                <Edit3 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => handleMoveToFolder(folder.id)}
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
                  <DropdownMenuItem onClick={handleRemoveFromFolder}>
                    <Move className="h-4 w-4 mr-2" />
                    Remove from folder
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </button>
    </div>
  );
}
