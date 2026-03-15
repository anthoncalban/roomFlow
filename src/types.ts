export type UserRole = 'Professor' | 'Administrator' | 'Facility Manager';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
}

export interface Schedule {
  id: string;
  roomId: string;
  subject: string;
  instructorId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  semester: '1st' | '2nd' | 'Summer';
  year: number;
}

export interface UsageLog {
  id: string;
  roomId: string;
  userId: string;
  subjectId?: string;
  entryTime: string;
  exitTime?: string;
  durationMinutes?: number;
  semester: string;
  year: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
