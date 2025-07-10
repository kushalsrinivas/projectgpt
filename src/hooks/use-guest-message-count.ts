"use client";

import { useState, useEffect } from "react";

const GUEST_MESSAGE_COUNT_KEY = "guestMsgCount";
const MAX_GUEST_MESSAGES = 3;

export function useGuestMessageCount() {
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [isClient, setIsClient] = useState(false);

  // Initialize from localStorage on client-side
  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem(GUEST_MESSAGE_COUNT_KEY);
    const count = stored ? Number.parseInt(stored, 10) : 0;
    setGuestMessageCount(Number.isNaN(count) ? 0 : count);
  }, []);

  // Increment guest message count
  const incrementGuestMessageCount = () => {
    if (!isClient) return;
    
    const newCount = guestMessageCount + 1;
    setGuestMessageCount(newCount);
    localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, newCount.toString());
  };

  // Reset guest message count (called after sign-in)
  const resetGuestMessageCount = () => {
    if (!isClient) return;
    
    setGuestMessageCount(0);
    localStorage.removeItem(GUEST_MESSAGE_COUNT_KEY);
  };

  // Check if guest has reached the limit
  const hasReachedLimit = guestMessageCount >= MAX_GUEST_MESSAGES;

  // Get remaining messages
  const remainingMessages = Math.max(0, MAX_GUEST_MESSAGES - guestMessageCount);

  return {
    guestMessageCount,
    incrementGuestMessageCount,
    resetGuestMessageCount,
    hasReachedLimit,
    remainingMessages,
    maxMessages: MAX_GUEST_MESSAGES,
    isClient,
  };
} 