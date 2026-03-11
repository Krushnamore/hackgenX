/**
 * useNotifications.ts
 *
 * Admin/SuperAdmin → notifications stored under key "admins" (shared)
 * Citizen         → notifications stored under their own userId
 */

import { useState, useEffect, useCallback } from 'react';

export type NotifType =
  | 'new_complaint'
  | 'status_change'
  | 'resolved'
  | 'points_earned'
  | 'badge_unlocked';

export interface Notification {
  id        : string;
  type      : NotifType;
  title     : string;
  message   : string;
  timestamp : number;
  read      : boolean;
  link?     : string;
  meta?     : Record<string, any>;
}

const STORAGE_KEY = (key: string) => `jv_notifs_${key}`;
const MAX_NOTIFS  = 50;

export const getNotifications = (key: string): Notification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(key));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveNotifications = (key: string, notifs: Notification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY(key), JSON.stringify(notifs.slice(0, MAX_NOTIFS)));
  } catch {}
};

export const addNotification = (
  key: string,
  notif: Omit<Notification, 'id' | 'timestamp' | 'read'>
) => {
  const existing = getNotifications(key);
  const newNotif: Notification = {
    ...notif,
    id        : `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp : Date.now(),
    read      : false,
  };
  saveNotifications(key, [newNotif, ...existing]);
  window.dispatchEvent(new CustomEvent('jv_notification', { detail: newNotif }));
  return newNotif;
};

export const markAllRead = (key: string) => {
  const notifs = getNotifications(key).map(n => ({ ...n, read: true }));
  saveNotifications(key, notifs);
  window.dispatchEvent(new CustomEvent('jv_notification'));
};

export const clearNotifications = (key: string) => {
  localStorage.removeItem(STORAGE_KEY(key));
  window.dispatchEvent(new CustomEvent('jv_notification'));
};

// Pass "admins" for admin/superAdmin, userId for citizen
export function useNotifications(storageKey: string | undefined) {
  const [notifs, setNotifs] = useState<Notification[]>(() =>
    storageKey ? getNotifications(storageKey) : []
  );

  const reload = useCallback(() => {
    if (storageKey) setNotifs(getNotifications(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    reload();
    window.addEventListener('jv_notification', reload);
    return () => window.removeEventListener('jv_notification', reload);
  }, [storageKey, reload]);

  const unread   = notifs.filter(n => !n.read).length;
  const markRead = useCallback(() => { if (storageKey) markAllRead(storageKey); }, [storageKey]);
  const clear    = useCallback(() => { if (storageKey) clearNotifications(storageKey); }, [storageKey]);

  return { notifs, unread, markRead, clear, reload };
}