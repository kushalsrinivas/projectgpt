import { useState, useEffect } from 'react';

export interface OfflineStatus {
  isOnline: boolean;
  isOffline: boolean;
  lastOnlineTime: Date | null;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

export function useOffline(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null);
  const [connectionType, setConnectionType] = useState<'wifi' | 'cellular' | 'ethernet' | 'unknown'>('unknown');

  useEffect(() => {
    // Initial status
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      setLastOnlineTime(new Date());
    }

    // Get connection type if available
    const updateConnectionType = () => {
      if ('connection' in navigator) {
        const connection = (navigator as unknown as { connection?: { effectiveType?: string; type?: string } }).connection;
        if (connection) {
          const type = connection.effectiveType || connection.type;
          if (type?.includes('wifi')) {
            setConnectionType('wifi');
          } else if (type?.includes('cellular') || type?.includes('mobile')) {
            setConnectionType('cellular');
          } else if (type?.includes('ethernet')) {
            setConnectionType('ethernet');
          } else {
            setConnectionType('unknown');
          }
        }
      }
    };

    updateConnectionType();

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineTime(new Date());
      updateConnectionType();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleConnectionChange = () => {
      updateConnectionType();
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for connection changes if available
    if ('connection' in navigator) {
      const connection = (navigator as unknown as { connection?: { addEventListener?: (event: string, handler: () => void) => void } }).connection;
      if (connection?.addEventListener) {
        connection.addEventListener('change', handleConnectionChange);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if ('connection' in navigator) {
        const connection = (navigator as unknown as { connection?: { removeEventListener?: (event: string, handler: () => void) => void } }).connection;
        if (connection?.removeEventListener) {
          connection.removeEventListener('change', handleConnectionChange);
        }
      }
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    lastOnlineTime,
    connectionType,
  };
} 