export interface TimelineStep {
  label: string;
  done: boolean;
  date: string | null;
}

export interface ComplaintFeedback {
  rating: number;
  comment: string;
  resolved: 'yes' | 'no' | 'partially';
}

export interface Complaint {
  id: string;
  citizenId: string;
  citizenName: string;
  citizenPhone: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  ward: number;
  location: string;
  gpsCoords: { lat: number; lng: number };
  photo: string;
  resolvePhoto: string;
  adminNote: string;
  assignedOfficer: string;
  department: string;
  mergedCount: number;
  supportCount: number;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineStep[];
  estimatedResolution: string;
  feedback: ComplaintFeedback | null;
  isSOS: boolean;
  sosType?: string;
}

export interface User {
  id: string;
  role: 'citizen' | 'admin';
  name: string;
  email: string;
  phone: string;
  age?: number;
  address?: string;
  ward?: number;
  pincode?: string;
  aadharLast4?: string;
  password: string;
  language?: string;
  points?: number;
  badge?: string;
  complaintsSubmitted?: number;
  complaintsResolved?: number;
  createdAt: string;
  employeeId?: string;
  department?: string;
  post?: string;
  joinedDate?: string;
}

export type Category = 'Road' | 'Water' | 'Sanitation' | 'Electricity' | 'Other';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type Status = 'Submitted' | 'Under Review' | 'In Progress' | 'Resolved' | 'Rejected';

export const CATEGORIES: Category[] = ['Road', 'Water', 'Sanitation', 'Electricity', 'Other'];
export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES: Status[] = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'];
export const WARDS = Array.from({ length: 20 }, (_, i) => i + 1);

export function getBadge(points: number): string {
  if (points >= 1000) return 'Gold';
  if (points >= 500) return 'Silver';
  return 'Bronze';
}

export function getPriorityClass(p: Priority) {
  const map = { Low: 'badge-priority-low', Medium: 'badge-priority-medium', High: 'badge-priority-high', Critical: 'badge-priority-critical' };
  return map[p];
}

export function getStatusClass(s: Status) {
  const map: Record<Status, string> = {
    'Submitted': 'badge-status-submitted',
    'Under Review': 'badge-status-review',
    'In Progress': 'badge-status-progress',
    'Resolved': 'badge-status-resolved',
    'Rejected': 'badge-status-rejected',
  };
  return map[s];
}
