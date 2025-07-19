"use client";

import { useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Upload,
  FileText,
  MoreVertical,
  Trash2,
  Download,
  Eye,
  Plus,
  Brain,
  Search,
  Network,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { folderRAGService } from "@/lib/folder-rag-service";
import { folderContextManager } from "@/lib/folder-context-manager";
import { KnowledgeGraphMindmap } from "./knowledge-graph-mindmap";
import type {
  FolderDocument,
  KnowledgeNode,
  KnowledgeEdge,
} from "@/lib/indexeddb";

interface FolderResourcesPanelProps {
  folderId: number;
  className?: string;
}

interface ProcessingStatus {
  [documentId: string]: "processing" | "completed" | "error";
}

const SUPPORTED_FILE_TYPES = [
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".html",
  ".css",
  ".xml",
];

export function FolderResourcesPanel({
  folderId,
  className,
}: FolderResourcesPanelProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id || "anonymous";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<FolderDocument[]>([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  }>({ nodes: [], edges: [] });
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(
    {}
  );
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<FolderDocument | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load documents and knowledge graph on mount
  const loadData = useCallback(async () => {
    try {
      const [docs, graph] = await Promise.all([
        folderRAGService.getDocuments(folderId, userId),
        folderRAGService.getKnowledgeGraph(folderId, userId),
      ]);

      setDocuments(docs);
      if (graph) {
        setKnowledgeGraph({
          nodes: graph.nodes,
          edges: graph.edges,
        });
      }
    } catch (error) {
      console.error("Error loading folder data:", error);
      toast.error("Failed to load folder resources");
    }
  }, [folderId, userId]);

  // Load data on component mount
  useState(() => {
    loadData();
  });

  // Handle file upload
  const handleFileUpload = useCallback(
    async (files: FileList) => {
      if (!files.length) return;

      setIsUploading(true);
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          // Validate file type
          const extension = "." + file.name.split(".").pop()?.toLowerCase();
          if (!SUPPORTED_FILE_TYPES.includes(extension)) {
            toast.error(`Unsupported file type: ${file.name}`);
            return null;
          }

          // Add document to RAG service
          const document = await folderRAGService.addDocument(
            folderId,
            userId,
            file
          );

          // Set processing status
          setProcessingStatus((prev) => ({
            ...prev,
            [document.id]: "processing",
          }));

          // Simulate processing completion (in real implementation, this would be event-driven)
          setTimeout(() => {
            setProcessingStatus((prev) => ({
              ...prev,
              [document.id]: "completed",
            }));
            loadData(); // Refresh the view
          }, 2000 + Math.random() * 3000); // 2-5 seconds

          return document;
        } catch (error) {
          console.error("Error uploading file:", file.name, error);
          toast.error(`Failed to upload ${file.name}`);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successful = results.filter(Boolean);

      if (successful.length > 0) {
        toast.success(`Successfully uploaded ${successful.length} file(s)`);
        await loadData();
      }

      setIsUploading(false);
    },
    [folderId, userId, loadData]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload]
  );

  // Handle delete document
  const handleDeleteDocument = async (documentId: string) => {
    try {
      await folderRAGService.deleteDocument(documentId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      toast.success("Document deleted successfully");
      await loadData(); // Refresh to update knowledge graph
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success("Resources refreshed");
  };

  // Filter documents based on search
  const filteredDocuments = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get document stats
  const stats = {
    totalDocuments: documents.length,
    totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
    types: new Set(documents.map((doc) => doc.type)).size,
    processed: Object.values(processingStatus).filter(
      (status) => status === "completed"
    ).length,
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "code":
        return "💻";
      case "pdf":
        return "📄";
      case "md":
        return "📝";
      case "json":
        return "📊";
      default:
        return "📄";
    }
  };

  const getStatusColor = (status: ProcessingStatus[string]) => {
    switch (status) {
      case "processing":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <Tabs defaultValue="documents" className="h-full flex flex-col">
        <div className="border-b bg-background px-4 py-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="mindmap" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Mind Map
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="flex-1 m-0 flex flex-col">
          {/* Header Controls */}
          <div className="border-b p-4 space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Documents</div>
                <div className="font-medium">{stats.totalDocuments}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Total Size</div>
                <div className="font-medium">
                  {formatFileSize(stats.totalSize)}
                </div>
              </div>
            </div>

            {/* Upload and Search */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={SUPPORTED_FILE_TYPES.join(",")}
                onChange={(e) =>
                  e.target.files && handleFileUpload(e.target.files)
                }
                className="hidden"
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Upload Files"}
              </Button>

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Upload Zone */}
          {documents.length === 0 && (
            <div
              className="flex-1 flex items-center justify-center m-4 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-center p-8">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">Upload Documents</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop files here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported: {SUPPORTED_FILE_TYPES.slice(0, 5).join(", ")} and
                  more
                </p>
              </div>
            </div>
          )}

          {/* Documents List */}
          {documents.length > 0 && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {filteredDocuments.map((doc) => {
                  const status = processingStatus[doc.id];

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-2xl">
                        {getDocumentIcon(doc.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{doc.name}</h4>
                          {status && (
                            <div className="flex items-center gap-1">
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  getStatusColor(status)
                                )}
                              />
                              <span className="text-xs text-muted-foreground capitalize">
                                {status}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="capitalize">{doc.type}</span>
                          <span>{formatFileSize(doc.size)}</span>
                          <span>
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setSelectedDocument(doc)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Content
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setDeleteDialog({ id: doc.id, name: doc.name })
                            }
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="mindmap" className="flex-1 m-0">
          <div className="h-full border-t">
            <KnowledgeGraphMindmap
              nodes={knowledgeGraph.nodes}
              edges={knowledgeGraph.edges}
              onNodeClick={(node) => {
                toast.info(`Selected: ${node.label} (${node.type})`);
              }}
              className="h-full"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Document Content Dialog */}
      {selectedDocument && (
        <Dialog
          open={!!selectedDocument}
          onOpenChange={() => setSelectedDocument(null)}
        >
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-xl">
                  {getDocumentIcon(selectedDocument.type)}
                </span>
                {selectedDocument.name}
              </DialogTitle>
              <DialogDescription>
                {selectedDocument.type} •{" "}
                {formatFileSize(selectedDocument.size)} • Added{" "}
                {new Date(selectedDocument.createdAt).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-96">
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {selectedDocument.content}
              </pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialog && (
        <AlertDialog
          open={!!deleteDialog}
          onOpenChange={() => setDeleteDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteDialog.name}"? This
                action cannot be undone and will remove all associated
                contextual data from this folder.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleDeleteDocument(deleteDialog.id);
                  setDeleteDialog(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
