"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Settings2,
  Server,
  Plug,
  CheckCircle,
  XCircle,
  Globe,
  Database,
  FileText,
  Code,
  Brain,
  Zap,
} from "lucide-react";

interface MCPServer {
  id: string;
  name: string;
  description: string;
  category: "web" | "database" | "files" | "code" | "ai" | "tools";
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  version: string;
  capabilities: string[];
  url?: string;
}

const mockMCPServers: MCPServer[] = [
  {
    id: "web-search",
    name: "Web Search",
    description:
      "Search the web and get real-time information from various sources",
    category: "web",
    enabled: true,
    status: "connected",
    version: "1.2.0",
    capabilities: ["search", "browse", "summarize"],
    url: "https://web-search.mcp.dev",
  },
  {
    id: "github-integration",
    name: "GitHub Integration",
    description:
      "Access and manage GitHub repositories, issues, and pull requests",
    category: "code",
    enabled: true,
    status: "connected",
    version: "2.1.0",
    capabilities: ["repos", "issues", "pulls", "commits"],
    url: "https://github.com/api",
  },
  {
    id: "file-system",
    name: "File System",
    description: "Read and write files in your local file system",
    category: "files",
    enabled: false,
    status: "disconnected",
    version: "1.0.5",
    capabilities: ["read", "write", "list", "search"],
  },
  {
    id: "postgres-db",
    name: "PostgreSQL Database",
    description: "Connect to and query PostgreSQL databases",
    category: "database",
    enabled: false,
    status: "disconnected",
    version: "3.2.1",
    capabilities: ["query", "schema", "backup"],
    url: "postgresql://localhost:5432",
  },
  {
    id: "anthropic-tools",
    name: "Anthropic Tools",
    description: "Access Anthropic's advanced AI tools and capabilities",
    category: "ai",
    enabled: true,
    status: "connected",
    version: "1.5.0",
    capabilities: ["analysis", "reasoning", "safety"],
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Perform mathematical calculations and complex computations",
    category: "tools",
    enabled: true,
    status: "connected",
    version: "1.0.0",
    capabilities: ["arithmetic", "algebra", "calculus"],
  },
  {
    id: "weather-api",
    name: "Weather API",
    description: "Get current weather and forecast information",
    category: "web",
    enabled: false,
    status: "error",
    version: "2.0.3",
    capabilities: ["current", "forecast", "alerts"],
    url: "https://api.weather.com",
  },
];

function getCategoryIcon(category: MCPServer["category"]) {
  switch (category) {
    case "web":
      return <Globe className="h-4 w-4" />;
    case "database":
      return <Database className="h-4 w-4" />;
    case "files":
      return <FileText className="h-4 w-4" />;
    case "code":
      return <Code className="h-4 w-4" />;
    case "ai":
      return <Brain className="h-4 w-4" />;
    case "tools":
      return <Zap className="h-4 w-4" />;
    default:
      return <Server className="h-4 w-4" />;
  }
}

function getStatusIcon(status: MCPServer["status"]) {
  switch (status) {
    case "connected":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "disconnected":
      return <XCircle className="h-4 w-4 text-gray-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <XCircle className="h-4 w-4 text-gray-500" />;
  }
}

export function MCPServersPanel() {
  const [servers, setServers] = useState<MCPServer[]>(mockMCPServers);
  const [open, setOpen] = useState(false);

  const toggleServer = (serverId: string) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === serverId
          ? {
              ...server,
              enabled: !server.enabled,
              status: !server.enabled ? "connected" : "disconnected",
            }
          : server
      )
    );
  };

  const enabledCount = servers.filter((s) => s.enabled).length;
  const connectedCount = servers.filter((s) => s.status === "connected").length;

  const categories = Array.from(new Set(servers.map((s) => s.category)));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">MCP Servers</span>
          <span className="sm:hidden">MCP</span>
          {enabledCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {enabledCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[400px] sm:w-[540px] p-5">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            MCP Servers
          </SheetTitle>
          <SheetDescription>
            Model Context Protocol servers extend your AI's capabilities. Enable
            servers to give your AI access to external tools and data sources.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Status summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 bg-card/50">
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Connected</span>
              </div>
              <p className="text-2xl font-bold text-green-500">
                {connectedCount}
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-card/50">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Available</span>
              </div>
              <p className="text-2xl font-bold text-blue-500">
                {servers.length}
              </p>
            </div>
          </div>

          {/* Servers list */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-6">
              {categories.map((category) => {
                const categoryServers = servers.filter(
                  (s) => s.category === category
                );

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      {getCategoryIcon(category)}
                      <h3 className="text-sm font-semibold capitalize">
                        {category} ({categoryServers.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {categoryServers.map((server) => (
                        <div
                          key={server.id}
                          className="rounded-lg border p-4 bg-card/30 hover:bg-card/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {server.name}
                                </span>
                                {getStatusIcon(server.status)}
                                <Badge variant="outline" className="text-xs">
                                  v{server.version}
                                </Badge>
                              </div>

                              <p className="text-xs text-muted-foreground mb-2">
                                {server.description}
                              </p>

                              {server.url && (
                                <p className="text-xs text-blue-400 mb-2">
                                  {server.url}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-1">
                                {server.capabilities.map((capability) => (
                                  <Badge
                                    key={capability}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {capability}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="ml-3">
                              <Switch
                                checked={server.enabled}
                                onCheckedChange={() => toggleServer(server.id)}
                                aria-label={`Toggle ${server.name}`}
                              />
                            </div>
                          </div>

                          {server.status === "error" && (
                            <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                              <p className="text-xs text-red-400">
                                Connection failed. Check server configuration.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {category !== categories[categories.length - 1] && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" size="sm">
              Add Custom Server
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setServers((prev) =>
                    prev.map((s) => ({
                      ...s,
                      enabled: false,
                      status: "disconnected" as const,
                    }))
                  );
                }}
              >
                Disable All
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
