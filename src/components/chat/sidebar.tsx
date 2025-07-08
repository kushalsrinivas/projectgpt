"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Plus,
  Settings,
  History,
  X,
  Zap,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onClose: () => void;
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  timestamp: Date;
  messageCount: number;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [conversations] = useState<Conversation[]>([
    {
      id: "1",
      title: "React Component Design",
      model: "GPT-4",
      timestamp: new Date(),
      messageCount: 12,
    },
    {
      id: "2",
      title: "Database Schema Planning",
      model: "Claude-3",
      timestamp: new Date(Date.now() - 3600000),
      messageCount: 8,
    },
    {
      id: "3",
      title: "API Integration Help",
      model: "GPT-3.5",
      timestamp: new Date(Date.now() - 7200000),
      messageCount: 5,
    },
  ]);

  const [credits] = useState(3); // Free credits available

  return (
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

      {/* Conversations */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-sidebar-foreground" />
            <span className="text-sm font-medium text-sidebar-foreground">
              Recent Chats
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="group cursor-pointer rounded-lg p-3 hover:bg-sidebar-accent transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {conversation.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {conversation.model}
                      </Badge>
                      <span className="text-xs text-sidebar-foreground/60">
                        {conversation.messageCount} messages
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-sidebar-foreground/60 mt-2">
                  {conversation.timestamp.toLocaleDateString()}
                </p>
              </div>
            ))}
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
        <Button variant="ghost" className="w-full justify-start mt-2" size="sm">
          <Crown className="h-4 w-4 mr-2" />
          Upgrade to Pro
        </Button>
      </div>
    </div>
  );
}
