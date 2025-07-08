"use client";

import { useState, useRef, useEffect } from "react";
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

interface ChatAreaProps {
  selectedModel: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  isStreaming?: boolean;
}

const sampleMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hello! I'm your AI assistant. I can help you with coding, writing, analysis, and more. What would you like to work on today?",
    timestamp: new Date(Date.now() - 300000),
    model: "GPT-4",
  },
  {
    id: "2",
    role: "user",
    content:
      "I need help building a React component for a todo list. Can you help me create one with add, edit, and delete functionality?",
    timestamp: new Date(Date.now() - 240000),
  },
  {
    id: "3",
    role: "assistant",
    content: `I'll help you create a comprehensive todo list component! Here's a React component with all the functionality you requested:

\`\`\`jsx
import React, { useState } from 'react';

const TodoList = () => {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const addTodo = () => {
    if (inputValue.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: inputValue,
        completed: false
      }]);
      setInputValue('');
    }
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditValue(todo.text);
  };

  const saveEdit = () => {
    setTodos(todos.map(todo => 
      todo.id === editingId 
        ? { ...todo, text: editValue }
        : todo
    ));
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Add a new todo..."
          className="flex-1 p-2 border rounded"
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        />
        <button onClick={addTodo} className="px-4 py-2 bg-blue-500 text-white rounded">
          Add
        </button>
      </div>
      
      <ul className="space-y-2">
        {todos.map(todo => (
          <li key={todo.id} className="flex items-center gap-2 p-2 border rounded">
            {editingId === todo.id ? (
              <>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 p-1 border rounded"
                />
                <button onClick={saveEdit} className="px-2 py-1 bg-green-500 text-white rounded text-sm">
                  Save
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{todo.text}</span>
                <button onClick={() => startEdit(todo)} className="px-2 py-1 bg-yellow-500 text-white rounded text-sm">
                  Edit
                </button>
                <button onClick={() => deleteTodo(todo.id)} className="px-2 py-1 bg-red-500 text-white rounded text-sm">
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoList;
\`\`\`

This component includes:
- **Add functionality**: Type in the input and click "Add" or press Enter
- **Edit functionality**: Click "Edit" to modify existing todos
- **Delete functionality**: Click "Delete" to remove todos
- **State management**: Uses React hooks to manage todos and editing state
- **Responsive design**: Clean, simple styling that works well

Would you like me to explain any part of the code or add additional features like todo completion status or local storage persistence?`,
    timestamp: new Date(Date.now() - 180000),
    model: "GPT-4",
  },
];

export function ChatArea({ selectedModel }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(sampleMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [needsCredit, setNeedsCredit] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!input.trim() || isLoading) return;

    // Check if premium model needs credit
    if (
      selectedModel.includes("gpt-4") ||
      selectedModel.includes("claude-3-sonnet")
    ) {
      setNeedsCredit(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "This is a simulated response. In the real implementation, this would connect to OpenRouter API to get responses from the selected AI model.",
        timestamp: new Date(),
        model: selectedModel,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
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

  const watchAdToUnlock = () => {
    // This would show an ad component
    alert("Ad functionality will be implemented here!");
    setNeedsCredit(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Credit requirement banner */}
      {needsCredit && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-yellow-100">
                This model requires a credit. Watch a short ad to unlock it!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={watchAdToUnlock}
                className="bg-yellow-600 hover:bg-yellow-700 text-black"
              >
                <Play className="h-3 w-3 mr-1" />
                Watch Ad (30s)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNeedsCredit(false)}
                className="border-yellow-500/30 text-yellow-100 hover:bg-yellow-500/10"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
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
                  <AvatarImage src="/ai-avatar.png" />
                  <AvatarFallback>AI</AvatarFallback>
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
                  <AvatarFallback>You</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 mt-1">
                <AvatarFallback>AI</AvatarFallback>
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
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-4">
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
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Using {selectedModel}</span>
            <div className="flex items-center gap-4">
              <span>Press Enter to send • Shift+Enter for new line</span>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span>3 credits remaining</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
