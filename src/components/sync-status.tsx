"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/use-offline";
import { syncService } from "@/lib/sync-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { SyncStatus } from "@/lib/sync-service";

interface SyncStatusComponentProps {
  className?: string;
  compact?: boolean;
}

export function SyncStatusComponent({
  className,
  compact = false,
}: SyncStatusComponentProps) {
  const { isOnline, isOffline, connectionType, lastOnlineTime } = useOffline();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    lastSync: null,
    nextSync: null,
    pendingItems: 0,
    errors: [],
  });

  useEffect(() => {
    // Initial sync status
    syncService.getStatus().then(setSyncStatus);

    // Set up sync status listener
    syncService.onStatusChanged(setSyncStatus);

    // Poll for sync status updates
    const interval = setInterval(async () => {
      const status = await syncService.getStatus();
      setSyncStatus(status);
    }, 10000); // Update every 10 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleForceSyncNow = async () => {
    try {
      await syncService.forceSyncNow();
    } catch (error) {
      console.error("Failed to force sync:", error);
    }
  };

  const getStatusIcon = () => {
    if (isOffline) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }

    if (syncStatus.isActive) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }

    if (syncStatus.pendingItems > 0) {
      return <CloudOff className="h-4 w-4 text-yellow-500" />;
    }

    if (syncStatus.errors.length > 0) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }

    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isOffline) {
      return "Offline";
    }

    if (syncStatus.isActive) {
      return "Syncing...";
    }

    if (syncStatus.pendingItems > 0) {
      return `${syncStatus.pendingItems} pending`;
    }

    if (syncStatus.errors.length > 0) {
      return "Sync errors";
    }

    return "Synced";
  };

  const getStatusColor = () => {
    if (isOffline) return "destructive";
    if (syncStatus.isActive) return "default";
    if (syncStatus.pendingItems > 0) return "secondary";
    if (syncStatus.errors.length > 0) return "destructive";
    return "default";
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 ${className}`}>
              {getStatusIcon()}
              {syncStatus.pendingItems > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {syncStatus.pendingItems}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{getStatusText()}</p>
              <p className="text-xs text-muted-foreground">
                Connection: {connectionType} ({isOnline ? "Online" : "Offline"})
              </p>
              <p className="text-xs text-muted-foreground">
                Last sync: {formatTime(syncStatus.lastSync)}
              </p>
              {syncStatus.pendingItems > 0 && (
                <p className="text-xs text-muted-foreground">
                  {syncStatus.pendingItems} items pending sync
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg ${className}`}
    >
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>

        {syncStatus.pendingItems > 0 && (
          <Badge variant="secondary" className="text-xs">
            {syncStatus.pendingItems} pending
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
        <div className="flex items-center gap-1">
          {isOnline ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-500" />
          )}
          <span>{connectionType}</span>
        </div>

        <span>•</span>

        <span>Last sync: {formatTime(syncStatus.lastSync)}</span>

        {syncStatus.pendingItems > 0 && (
          <>
            <span>•</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleForceSyncNow}
              disabled={syncStatus.isActive}
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync Now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
