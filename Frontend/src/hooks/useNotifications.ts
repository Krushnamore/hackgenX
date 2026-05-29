/**
 * useNotifications.ts
 *
 * Storage keys:
 *   "superadmin"          → Super Admin only
 *   "admins"              → All admins (generic / dept-agnostic)
 *   "dept_{department}"   → A specific department's admins  e.g. "dept_Roads"
 *   "{userId}"            → Individual citizen or admin
 */

import { useState, useEffect, useCallback } from 'react';

export type NotifType =
  | 'new_complaint'        // new complaint filed
  | 'status_change'        // status updated
  | 'resolved'             // complaint resolved
  | 'points_earned'        // citizen earned points
  | 'badge_unlocked'       // citizen unlocked a badge
  | 'document_received'    // admin sent a document to citizen
  | 'admin_approval';      // new dept admin awaiting superadmin approval

export interface Notification {
  id         : string;
  type       : NotifType;
  title      : string;
  message    : string;
  timestamp  : number;
  read       : boolean;
  link?      : string;
  meta?      : Record<string, any>;
}

/* ─── storage helpers ─────────────────────────────────────── */

const STORAGE_KEY = (key: string) => `jv_notifs_${key}`;
const MAX_NOTIFS  = 50;

export const getNotifications = (key: string): Notification[] => {
  try {
    const raw    = localStorage.getItem(STORAGE_KEY(key));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export const saveNotifications = (key: string, notifs: Notification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY(key), JSON.stringify(notifs.slice(0, MAX_NOTIFS)));
  } catch {}
};

/* ─── core add ────────────────────────────────────────────── */

export const addNotification = (
  key: string,
  notif: Omit<Notification, 'id' | 'timestamp' | 'read'>,
): Notification | null => {
  if (!key) return null;
  const newNotif: Notification = {
    ...notif,
    id       : `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    read     : false,
  };
  saveNotifications(key, [newNotif, ...getNotifications(key)]);
  window.dispatchEvent(
    new CustomEvent('jv_notification', { detail: { key, notif: newNotif } }),
  );
  return newNotif;
};

/* ─── department key helper ───────────────────────────────── */

/**
 * Returns the storage key for a department's admin channel.
 * e.g. deptKey("Roads")  → "dept_Roads"
 *      deptKey(undefined) → "admins"   (fallback)
 */
export const deptKey = (department?: string | null): string =>
  department ? `dept_${department}` : 'admins';

/* ─── domain-level helpers ────────────────────────────────── */

/**
 * Notify the department admin channel when a new complaint is filed.
 * Also notifies the generic "admins" channel so dashboard admins see it.
 */
export const notifyNewComplaint = (complaint: {
  id        : string;
  complaintId?: string;
  title     : string;
  category  : string;
  ward?     : string | number;
  department?: string | null;
  citizenName?: string;
}) => {
  const payload = {
    type   : 'new_complaint' as NotifType,
    title  : '📋 New Complaint Filed',
    message: `${complaint.title} — ${complaint.category}, Zone ${complaint.ward ?? '—'} by ${complaint.citizenName ?? 'Citizen'}`,
    link   : '/admin/complaints',
    meta   : { complaintId: complaint.complaintId ?? complaint.id },
  };

  // Notify the specific department
  addNotification(deptKey(complaint.department), payload);

  // Also notify generic admins channel (superadmin dashboards, etc.)
  if (complaint.department) {
    addNotification('admins', payload);
  }
};

/**
 * Notify a citizen that their complaint status changed.
 */
export const notifyStatusChange = (params: {
  citizenId  : string;
  title      : string;
  status     : string;
  trackId    : string;
}) => {
  addNotification(params.citizenId, {
    type   : 'status_change',
    title  : '🔄 Complaint Status Updated',
    message: `Your complaint "${params.title}" status changed to "${params.status}".`,
    link   : `/citizen/track?id=${params.trackId}`,
  });
};

/**
 * Notify citizen + admins when a complaint is resolved.
 */
export const notifyResolved = (params: {
  citizenId  : string;
  title      : string;
  trackId    : string;
  officer?   : string;
  department?: string | null;
  resolvedBy?: string;
}) => {
  // Citizen: resolved
  addNotification(params.citizenId, {
    type   : 'resolved',
    title  : '✅ Your Complaint Was Resolved!',
    message: `"${params.title}" has been resolved by ${params.officer ?? 'Municipal Officer'}. +100 points awarded!`,
    link   : `/citizen/track?id=${params.trackId}`,
  });

  // Citizen: points
  addNotification(params.citizenId, {
    type   : 'points_earned',
    title  : '🏆 +100 Points Earned!',
    message: 'Your complaint was resolved! Check your rewards page.',
    link   : '/citizen/rewards',
  });

  // Department admin channel
  addNotification(deptKey(params.department), {
    type   : 'status_change',
    title  : '✅ Complaint Resolved',
    message: `"${params.title}" was resolved by ${params.resolvedBy ?? params.officer ?? 'Officer'}.`,
    link   : '/admin/complaints',
  });

  // Generic admins
  addNotification('admins', {
    type   : 'status_change',
    title  : '✅ Complaint Resolved',
    message: `"${params.title}" was resolved by ${params.resolvedBy ?? params.officer ?? 'Officer'}.`,
    link   : '/admin/complaints',
  });
};

/**
 * Notify a citizen that an admin has sent them a document.
 */
export const notifyDocumentSent = (params: {
  citizenId   : string;
  documentName: string;
  complaintId?: string;
  sentBy?     : string;
}) => {
  addNotification(params.citizenId, {
    type   : 'document_received',
    title  : '📄 Document Received',
    message: `"${params.documentName}" was sent to you by ${params.sentBy ?? 'Admin'}${params.complaintId ? ` regarding complaint #${params.complaintId}` : ''}.`,
    link   : params.complaintId
      ? `/citizen/track?id=${params.complaintId}`
      : '/citizen/dashboard',
    meta: { documentName: params.documentName, sentBy: params.sentBy },
  });
};

/**
 * Notify the Super Admin when a new department admin registration
 * is pending approval.
 */
export const notifyAdminRegistrationPending = (params: {
  name      : string;
  department: string;
  email     : string;
  userId?   : string;
}) => {
  addNotification('superadmin', {
    type   : 'admin_approval',
    title  : '🔔 New Admin Registration Request',
    message: `${params.name} from "${params.department}" department (${params.email}) is awaiting approval.`,
    link   : '/admin/settings',
    meta   : { userId: params.userId, department: params.department },
  });
};

/* ─── read / clear ────────────────────────────────────────── */

export const markAllRead = (key: string) => {
  if (!key) return;
  const notifs = getNotifications(key).map(n => ({ ...n, read: true }));
  saveNotifications(key, notifs);
  window.dispatchEvent(new CustomEvent('jv_notification', { detail: { key } }));
};

export const clearNotifications = (key: string) => {
  if (!key) return;
  localStorage.removeItem(STORAGE_KEY(key));
  window.dispatchEvent(new CustomEvent('jv_notification', { detail: { key } }));
};

/* ─── hook ────────────────────────────────────────────────── */

/**
 * Pass one of:
 *   "superadmin"        → Super Admin
 *   "admins"            → All admins
 *   deptKey("Roads")    → Department channel
 *   userId              → Individual citizen / admin
 *
 * Safe to call with undefined — returns empty state until key is available.
 */
export function useNotifications(storageKey: string | undefined) {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  const reload = useCallback(() => {
    setNotifs(storageKey ? getNotifications(storageKey) : []);
  }, [storageKey]);

  useEffect(() => { reload(); }, [storageKey, reload]);

  useEffect(() => {
    if (!storageKey) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.key || detail.key === storageKey) reload();
    };
    window.addEventListener('jv_notification', handler);
    return () => window.removeEventListener('jv_notification', handler);
  }, [storageKey, reload]);

  const unread   = notifs.filter(n => !n.read).length;
  const markRead = useCallback(() => { if (storageKey) markAllRead(storageKey); }, [storageKey]);
  const clear    = useCallback(() => { if (storageKey) clearNotifications(storageKey); }, [storageKey]);

  return { notifs, unread, markRead, clear, reload };
}