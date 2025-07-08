"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Plus,
  X,
  FileText,
  Code,
  Database,
  Settings as SettingsIcon,
} from "lucide-react";

interface ProjectContextPanelProps {
  context: string[];
  onContextChange: (context: string[]) => void;
}

interface ContextItem {
  id: string;
  name: string;
  type: "file" | "folder" | "database" | "api";
  path: string;
  size: string;
  lastModified: Date;
}

const mockContextItems: ContextItem[] = [
  {
    id: "1",
    name: "src/components",
    type: "folder",
    path: "/src/components",
    size: "24 files",
    lastModified: new Date(),
  },
  {
    id: "2",
    name: "package.json",
    type: "file",
    path: "/package.json",
    size: "2.1 KB",
    lastModified: new Date(),
  },
  {
    id: "3",
    name: "Database Schema",
    type: "database",
    path: "/schema.sql",
    size: "156 tables",
    lastModified: new Date(),
  },
  {
    id: "4",
    name: "API Routes",
    type: "api",
    path: "/api",
    size: "12 endpoints",
    lastModified: new Date(),
  },
];

function getIconForType(type: ContextItem["type"]) {
  switch (type) {
    case "file":
      return <FileText className="h-4 w-4" />;
    case "folder":
      return <FolderOpen className="h-4 w-4" />;
    case "database":
      return <Database className="h-4 w-4" />;
    case "api":
      return <Code className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export function ProjectContextPanel({
  context,
  onContextChange,
}: ProjectContextPanelProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>(context);
  const [open, setOpen] = useState(false);

  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSaveContext = () => {
    onContextChange(selectedItems);
    setOpen(false);
  };

  const selectedCount = selectedItems.length;
  const contextSize =
    selectedCount > 0 ? `${selectedCount} items` : "No context";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Project Context</span>
          <span className="sm:hidden">Context</span>
          {selectedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Project Context Management
          </DialogTitle>
          <DialogDescription>
            Select files, folders, and resources to include in your AI
            conversations. This helps the AI understand your project structure
            and provide better assistance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Current context summary */}
          <div className="rounded-lg border p-3 bg-card/50 border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current Context</span>
              <span className="text-xs text-muted-foreground">
                {contextSize}
              </span>
            </div>

            {selectedItems.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedItems.slice(0, 5).map((itemId) => {
                  const item = mockContextItems.find((i) => i.id === itemId);
                  return item ? (
                    <Badge key={itemId} variant="outline" className="text-xs">
                      {item.name}
                    </Badge>
                  ) : null;
                })}
                {selectedItems.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedItems.length - 5} more
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No items selected. AI will work with general knowledge only.
              </p>
            )}
          </div>

          {/* Available items */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Available Items</h4>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Custom
              </Button>
            </div>

            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                {mockContextItems.map((item) => {
                  const isSelected = selectedItems.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors w-full text-left ${
                        isSelected
                          ? "bg-primary/20 border border-primary/30 text-primary-foreground"
                          : "hover:bg-muted/30 border border-transparent"
                      }`}
                      onClick={() => handleToggleItem(item.id)}
                      aria-label={`Toggle ${item.name} context`}
                    >
                      <div className="flex items-center gap-3">
                        {getIconForType(item.type)}
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.path} • {item.size}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <Badge variant="default" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setSelectedItems([])}
              disabled={selectedItems.length === 0}
            >
              Clear All
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveContext}>
                Save Context ({selectedItems.length})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
