"use client";

import { useState } from "react";
import { EnhancedSidebar } from "@/components/chat/enhanced-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { FolderView } from "@/components/chat/folder-view";
import { ModelSelector } from "@/components/chat/model-selector";
import { ProjectContextPanel } from "@/components/chat/project-context-panel";
import { MCPServersPanel } from "@/components/chat/mcp-servers-panel";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4");
  const [projectContext, setProjectContext] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);

  const handleNewChat = () => {
    setSelectedConversationId(null);
    setSelectedFolderId(null); // Return to normal chat layout
  };

  const handleFolderSelect = (folderId: number) => {
    setSelectedFolderId(folderId);
    setSelectedConversationId(null); // Clear conversation selection when folder is selected
  };

  const handleNewChatFromFolder = (conversationId?: string) => {
    setSelectedFolderId(null);
    if (conversationId) {
      setSelectedConversationId(conversationId);
    } else {
      setSelectedConversationId(null);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[20vw] transform bg-sidebar border-r transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <EnhancedSidebar
          onClose={() => setSidebarOpen(false)}
          onConversationSelect={setSelectedConversationId}
          selectedConversationId={selectedConversationId}
          onNewChat={handleNewChat}
          onFolderSelect={handleFolderSelect}
          selectedFolderId={selectedFolderId}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">ProjectGPT</h1>
          </div>

          <div className="flex items-center gap-3">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
            <ProjectContextPanel
              context={projectContext}
              onContextChange={setProjectContext}
            />
            <MCPServersPanel />
          </div>
        </header>

        {/* Chat area or Folder view */}
        {selectedFolderId ? (
          <FolderView
            folderId={selectedFolderId}
            selectedModel={selectedModel}
            onNewChatFromFolder={handleNewChatFromFolder}
          />
        ) : (
          <ChatArea
            selectedModel={selectedModel}
            selectedConversationId={selectedConversationId}
          />
        )}
      </div>
    </div>
  );
}
