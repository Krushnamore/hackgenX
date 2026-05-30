/**
 * useNotifications.ts — REAL-TIME CROSS-TAB NOTIFICATION SERVICE
 *
 * Uses TWO event systems:
 * 1. window.dispatchEvent('jv_notification') — same tab, instant
 * 2. window.addEventListener('storage')      — cross-tab (admin resolves → citizen sees it)
 *
 * Keys:
 *   citizen userId  → personal notifications
 *   "admins"        → all dept_officer / admin
 *   "superadmin"    → superAdmin only
 *   deptKey(dept)   → e.g. "dept_Water_Supply"
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type NotifType =
  | 'new_complaint'
  | 'status_change'
  | 'resolved'
  | 'points_earned'
  | 'badge_unlocked'
  | 'document_sent'
  | 'admin_pending';

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
const EVENT_NAME  = 'jv_notification';

/* ── Key helpers ─────────────────────────────────────────── */

// No spaces in localStorage keys
export const deptKey = (dept: string) =>
  `dept_${(dept || '').replace(/\s+/g, '_')}`;

/* ── Storage helpers ─────────────────────────────────────── */

export const getNotifications = (key: string): Notification[] => {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY(key));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export const saveNotifications = (key: string, notifs: Notification[]) => {
  if (!key) return;
  try {
    localStorage.setItem(STORAGE_KEY(key), JSON.stringify(notifs.slice(0, MAX_NOTIFS)));
  } catch {}
};

export const addNotification = (
  key: string,
  notif: Omit<Notification, 'id' | 'timestamp' | 'read'>
): Notification | null => {
  if (!key) return null;
  const existing = getNotifications(key);
  const newNotif: Notification = {
    ...notif,
    id       : `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    read     : false,
  };
  saveNotifications(key, [newNotif, ...existing]);

  // Same-tab event
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }));

  // Cross-tab: write a trigger key so other tabs' storage listener fires
  try {
    localStorage.setItem(
      `jv_notif_trigger`,
      JSON.stringify({ key, ts: Date.now() })
    );
    // Remove it immediately — the storage event fires on set, not on remove
    localStorage.removeItem('jv_notif_trigger');
  } catch {}

  return newNotif;
};

export const markAllRead = (key: string) => {
  if (!key) return;
  saveNotifications(key, getNotifications(key).map(n => ({ ...n, read: true })));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }));
};

export const clearNotifications = (key: string) => {
  if (!key) return;
  localStorage.removeItem(STORAGE_KEY(key));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }));
};

/* ── Category → Department mapping (must match backend DEPT_TO_CATEGORY) ── */

export const CATEGORY_TO_DEPT: Record<string, string> = {
  'Road'        : 'Roads & Infrastructure',
  'Roads'       : 'Roads & Infrastructure',
  'Water'       : 'Water Supply',
  'Sanitation'  : 'Sanitation',
  'Electricity' : 'Electricity',
  'Electric'    : 'Electricity',
  'Planning'    : 'Planning',
  'General'     : 'General Administration',
  'Other'       : 'General Administration',
};

// Get the dept notification key from a complaint category
export const categoryToDeptKey = (category?: string): string | null => {
  if (!category) return null;
  // Try exact match first
  const dept = CATEGORY_TO_DEPT[category]
    || Object.entries(CATEGORY_TO_DEPT).find(([k]) =>
        category.toLowerCase().includes(k.toLowerCase())
      )?.[1];
  return dept ? deptKey(dept) : null;
};

/* ── Role-based notification helpers ─────────────────────── */

export const notifyNewComplaint = (params: {
  id: string; complaintId?: string; title: string;
  category?: string; ward?: number; department?: string; citizenName?: string;
}) => {
  const msg = `${params.title} — ${params.category || ''}, Zone ${params.ward || ''} by ${params.citizenName || 'Citizen'}`;

  // Route to correct dept channel using category (since complaints store category not department)
  const deptNotifKey = params.department
    ? deptKey(params.department)
    : categoryToDeptKey(params.category);

  if (deptNotifKey) {
    addNotification(deptNotifKey, {
      type: 'new_complaint', title: '📋 New Complaint in Your Department',
      message: msg, link: '/admin/complaints', meta: { complaintId: params.id },
    });
  }
  addNotification('admins', {
    type: 'new_complaint', title: '📋 New Complaint Filed',
    message: msg, link: '/admin/complaints', meta: { complaintId: params.id },
  });
  addNotification('superadmin', {
    type: 'new_complaint', title: '📋 New Complaint Filed',
    message: msg, link: '/admin/complaints', meta: { complaintId: params.id },
  });
};

export const notifyStatusChange = (params: {
  citizenId: string; title: string; status: string; trackId: string;
}) => {
  addNotification(params.citizenId, {
    type: 'status_change', title: '🔄 Complaint Status Updated',
    message: `Your complaint "${params.title}" status changed to "${params.status}".`,
    link: `/citizen/track?id=${params.trackId}`,
  });
};

export const notifyResolved = (params: {
  citizenId: string; title: string; trackId: string;
  officer?: string; department?: string; category?: string; resolvedBy?: string;
}) => {
  addNotification(params.citizenId, {
    type: 'resolved', title: '✅ Your Complaint Was Resolved!',
    message: `"${params.title}" resolved by ${params.officer || 'Municipal Officer'}. +100 points awarded!`,
    link: `/citizen/track?id=${params.trackId}`,
  });
  addNotification(params.citizenId, {
    type: 'points_earned', title: '🏆 +100 Points Earned!',
    message: 'Your complaint was resolved! Check your rewards.',
    link: '/citizen/rewards',
  });
  // Route to dept channel using department name or category
  const deptNotifKey = params.department
    ? deptKey(params.department)
    : categoryToDeptKey(params.category);
  if (deptNotifKey) {
    addNotification(deptNotifKey, {
      type: 'status_change', title: '✅ Complaint Resolved',
      message: `${params.title} resolved by ${params.resolvedBy || params.officer || 'Officer'}.`,
      link: '/admin/complaints',
    });
  }
  addNotification('admins', {
    type: 'status_change', title: '✅ Complaint Resolved',
    message: `${params.title} resolved by ${params.resolvedBy || params.officer || 'Officer'}.`,
    link: '/admin/complaints',
  });
  addNotification('superadmin', {
    type: 'status_change', title: '✅ Complaint Resolved',
    message: `${params.title} resolved by ${params.resolvedBy || params.officer || 'Officer'}.`,
    link: '/admin/complaints',
  });
};

export const notifyDocumentSent = (params: {
  citizenId: string; documentName: string; complaintId?: string; sentBy?: string;
}) => {
  addNotification(params.citizenId, {
    type: 'document_sent', title: '📄 Document Received',
    message: `"${params.documentName}" sent by ${params.sentBy || 'Admin'}. View in complaint details.`,
    link: params.complaintId ? `/citizen/track?id=${params.complaintId}` : '/citizen/track',
    meta: { documentName: params.documentName, complaintId: params.complaintId },
  });
};

export const notifyAdminRegistrationPending = (params: {
  name: string; department: string; email: string; userId?: string;
}) => {
  addNotification('superadmin', {
    type: 'admin_pending', title: '⏳ New Admin Registration Pending',
    message: `${params.name} from ${params.department} (${params.email}) requested access. Approve in Settings.`,
    link: '/admin/settings',
    meta: { userId: params.userId, department: params.department },
  });
  addNotification('admins', {
    type: 'admin_pending', title: '⏳ New Officer Registration',
    message: `${params.name} (${params.department}) is pending Super Admin approval.`,
    link: '/admin/settings',
  });
};

/* ── React hook — real-time, cross-tab ───────────────────── */

export function useNotifications(storageKey: string | undefined) {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  const keyRef = useRef(storageKey);
  keyRef.current = storageKey;

  const reload = useCallback(() => {
    const key = keyRef.current;
    setNotifs(key ? getNotifications(key) : []);
  }, []);

  // Load on mount and key change
  useEffect(() => {
    reload();
  }, [storageKey, reload]);

  // Same-tab custom event listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.key || detail.key === keyRef.current) reload();
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [reload]);

  // ✅ Cross-tab storage event listener — THIS is what makes it real-time
  // When admin (tab 2) calls addNotification(citizenId, ...), it writes to
  // localStorage, which fires 'storage' event in citizen's tab (tab 1)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (!keyRef.current) return;
      const myStorageKey = STORAGE_KEY(keyRef.current);
      // Reload if OUR specific key was changed
      if (e.key === myStorageKey) {
        reload();
        return;
      }
      // Also reload if the trigger key fired with our key
      if (e.key === 'jv_notif_trigger' && e.newValue) {
        try {
          const { key } = JSON.parse(e.newValue);
          if (key === keyRef.current) reload();
        } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [reload]);

  const unread = notifs.filter(n => !n.read).length;

  const markRead = useCallback(() => {
    const key = keyRef.current;
    if (key) { markAllRead(key); reload(); }
  }, [reload]);

  const clear = useCallback(() => {
    const key = keyRef.current;
    if (key) { clearNotifications(key); reload(); }
  }, [reload]);

  return { notifs, unread, markRead, clear, reload };
}