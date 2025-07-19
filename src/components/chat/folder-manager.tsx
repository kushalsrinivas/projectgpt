"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder,
  Plus,
  MoreHorizontal,
  Edit3,
  Trash2,
  Palette,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface FolderManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FolderItem {
  id: number;
  name: string;
  color: string;
  conversationCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}

const DEFAULT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#6b7280", // gray
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
  "#8b5a2b", // brown
  "#e11d48", // rose
  "#7c3aed", // purple
  "#059669", // green
  "#dc2626", // red-600
];

export function FolderManager({ open, onOpenChange }: FolderManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [colorPicker, setColorPicker] = useState<{
    id: number;
    currentColor: string;
  } | null>(null);

  // tRPC hooks
  const { data: folders = [], refetch } = api.folder.getAll.useQuery();
  const createFolder = api.folder.create.useMutation();
  const updateFolder = api.folder.update.useMutation();
  const deleteFolder = api.folder.delete.useMutation();

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder.mutateAsync({
        name: newFolderName.trim(),
      });

      setNewFolderName("");
      setIsCreating(false);
      await refetch();
      toast.success("Folder created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create folder"
      );
    }
  };

  const handleRenameFolder = async (id: number, name: string) => {
    if (!name.trim()) return;

    try {
      await updateFolder.mutateAsync({
        id,
        name: name.trim(),
      });

      setEditingFolder(null);
      await refetch();
      toast.success("Folder renamed successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to rename folder"
      );
    }
  };

  const handleDeleteFolder = async (id: number) => {
    try {
      await deleteFolder.mutateAsync({ id });

      setDeleteDialog(null);
      await refetch();
      toast.success("Folder deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete folder"
      );
    }
  };

  const handleColorChange = async (id: number, color: string) => {
    try {
      await updateFolder.mutateAsync({
        id,
        color,
      });

      setColorPicker(null);
      await refetch();
      toast.success("Folder color updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update folder color"
      );
    }
  };

  const getCharacterCount = (text: string) => text.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Folder Management
            </DialogTitle>
            <DialogDescription>
              Organize your conversations into folders for better organization
              and quick access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create new folder */}
            <div className="flex items-center gap-2">
              {isCreating ? (
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Enter folder name..."
                      maxLength={30}
                      className="pr-12"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder();
                        if (e.key === "Escape") {
                          setIsCreating(false);
                          setNewFolderName("");
                        }
                      }}
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {getCharacterCount(newFolderName)}/30
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || createFolder.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false);
                      setNewFolderName("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsCreating(true)}
                  className="gap-2"
                  disabled={folders.length >= 20} // Reasonable limit
                >
                  <Plus className="h-4 w-4" />
                  New Folder
                </Button>
              )}
            </div>

            {/* Folders list */}
            <ScrollArea className="h-96 border rounded-lg">
              <div className="p-4 space-y-2">
                {folders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No folders yet</p>
                    <p className="text-sm">
                      Create your first folder to get started
                    </p>
                  </div>
                ) : (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: folder.color }}
                        />

                        {editingFolder?.id === folder.id ? (
                          <div className="relative flex-1">
                            <Input
                              value={editingFolder.name}
                              onChange={(e) =>
                                setEditingFolder({
                                  ...editingFolder,
                                  name: e.target.value,
                                })
                              }
                              maxLength={30}
                              className="pr-12"
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleRenameFolder(
                                    folder.id,
                                    editingFolder.name
                                  );
                                if (e.key === "Escape") setEditingFolder(null);
                              }}
                              onBlur={() =>
                                handleRenameFolder(
                                  folder.id,
                                  editingFolder.name
                                )
                              }
                              autoFocus
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {getCharacterCount(editingFolder.name)}/30
                            </span>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {folder.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {folder.conversationCount} conversation
                              {folder.conversationCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {folder.conversationCount}
                        </Badge>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setEditingFolder({
                                  id: folder.id,
                                  name: folder.name,
                                })
                              }
                            >
                              <Edit3 className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setColorPicker({
                                  id: folder.id,
                                  currentColor: folder.color,
                                })
                              }
                            >
                              <Palette className="h-4 w-4 mr-2" />
                              Change Color
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setDeleteDialog({
                                  id: folder.id,
                                  name: folder.name,
                                })
                              }
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Color picker dialog */}
      {colorPicker && (
        <Dialog open={true} onOpenChange={() => setColorPicker(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Choose Folder Color</DialogTitle>
              <DialogDescription>
                Select a color for your folder to help organize your
                conversations.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-4 gap-3 py-4">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorChange(colorPicker.id, color)}
                  className={cn(
                    "w-12 h-12 rounded-lg border-2 transition-all hover:scale-105",
                    color === colorPicker.currentColor
                      ? "border-white shadow-lg ring-2 ring-primary"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setColorPicker(null)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation dialog */}
      {deleteDialog && (
        <AlertDialog open={true} onOpenChange={() => setDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete folder '{deleteDialog.name}'?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. Conversations inside this folder
                will remain in 'All Chats'.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteFolder(deleteDialog.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Folder
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
