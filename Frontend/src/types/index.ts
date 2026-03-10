/**
 * Frontend/src/types/index.ts
 *
 * CHANGED: UserRole now includes 'superAdmin' and 'dept_officer'
 */

// ── User roles ────────────────────────────────────────────────
export type UserRole = 'citizen' | 'admin' | 'superAdmin' | 'dept_officer';

// Helper: returns true for any admin-tier role
export const isAdminRole = (role?: string): boolean =>
  ['admin', 'superAdmin', 'dept_officer'].includes(role || '');

// ── Complaint types ───────────────────────────────────────────
export type Category = 'Road' | 'Water' | 'Sanitation' | 'Electricity' | 'Other';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type Status   = 'Submitted' | 'Under Review' | 'In Progress' | 'Resolved' | 'Rejected';

export const CATEGORIES: Category[] = ['Road', 'Water', 'Sanitation', 'Electricity', 'Other'];
export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES:   Status[]   = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'];

// ── Department list (matches backend DEPT_TO_CATEGORY map) ────
export const DEPARTMENTS = [
  'Roads & Infrastructure',
  'Water Supply',
  'Sanitation',
  'Electricity',
  'Planning',
  'General Administration',
] as const;
export type Department = typeof DEPARTMENTS[number];

// ── Category → Department mapping ────────────────────────────
// Used in Dashboard, Complaints, Resolve for role-based filtering
export const CATEGORY_DEPT_MAP: Record<Category, Department> = {
  Road        : 'Roads & Infrastructure',
  Water       : 'Water Supply',
  Sanitation  : 'Sanitation',
  Electricity : 'Electricity',
  Other       : 'General Administration',
};

// ── Badge helpers ─────────────────────────────────────────────
export const getPriorityClass = (priority: string): string => {
  const map: Record<string, string> = {
    Critical : 'badge-pill bg-destructive text-destructive-foreground',
    High     : 'badge-pill bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    Medium   : 'badge-pill bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    Low      : 'badge-pill bg-muted text-muted-foreground',
  };
  return map[priority] || 'badge-pill bg-muted text-muted-foreground';
};

export const getStatusClass = (status: string): string => {
  const map: Record<string, string> = {
    Submitted    : 'badge-pill bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Under Review': 'badge-pill bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    'In Progress' : 'badge-pill bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    Resolved     : 'badge-pill bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    Rejected     : 'badge-pill bg-destructive/10 text-destructive',
  };
  return map[status] || 'badge-pill bg-muted text-muted-foreground';
};

// ── User interface ────────────────────────────────────────────
export interface User {
  _id         : string;
  id          : string;
  role        : UserRole;
  name        : string;
  email       : string;
  phone       : string;
  department  ?: string;
  post        ?: string;
  employeeId  ?: string;
  joinedDate  ?: string;
  avatar      ?: string | null;
  // Citizen fields
  ward        ?: number;
  points      ?: number;
  badge       ?: 'Bronze' | 'Silver' | 'Gold';
  complaintsSubmitted?: number;
  complaintsResolved ?: number;
  language    ?: string;
  createdAt   ?: string;
  updatedAt   ?: string;
}

// ── Complaint interface ───────────────────────────────────────
export interface Complaint {
  _id             : string;
  id              : string;   // normalised complaintId string e.g. JV-2026-00001
  complaintId     : string;
  citizenId       : string;
  citizenName     : string;
  citizenPhone    : string;
  citizenEmail   ?: string;
  title           : string;
  description     : string;
  category        : Category;
  priority        : Priority;
  status          : Status;
  ward            : number;
  location       ?: string;
  gpsCoords      ?: { lat: number; lng: number };
  photo          ?: string;
  resolvePhoto   ?: string;
  adminNote      ?: string;
  assignedOfficer?: string;
  department     ?: string;
  mergedCount    ?: number;
  supportCount   ?: number;
  supportedBy    ?: string[];
  timeline        : { label: string; done: boolean; date: string | null }[];
  estimatedResolution?: string;
  feedback       ?: { rating: number; comment?: string; resolved?: 'yes' | 'no' | 'partially' } | null;
  isSOS          ?: boolean;
  sosType        ?: string;
  createdAt       : string;
  updatedAt       : string;
}