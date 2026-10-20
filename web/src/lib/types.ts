export type AssignmentType = 'ASSIGNMENT' | 'GROUP_WORK' | 'SMALL_QUIZ' | 'EXAM';
export type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';

export interface CourseRef {
  id: string;
  code: string | null;
  name: string;
  color: string;
}

export interface Course extends CourseRef {
  professor: string | null;
  openCount: number;
}

export interface Assignment {
  id: string;
  title: string;
  type: AssignmentType;
  status: Status;
  state: 'DRAFT' | 'CONFIRMED';
  courseId: string | null;
  course: CourseRef | null;
  startDate: string; // YYYY-MM-DD
  dueAt: string | null;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:MM
  details: string;
  sourceText: string | null;
  hasImage: boolean;
  suggestedCourseCode: string | null;
  suggestedCourseName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the forms send to the API. */
export interface AssignmentInput {
  title: string;
  courseId: string | null;
  type: AssignmentType;
  status: Status;
  startDate: string;
  dueDate: string | null;
  dueTime: string | null;
  details: string;
}

export interface User {
  id: string;
  displayName: string;
  pictureUrl: string | null;
}

export interface PublicConfig {
  liffId: string;
  devLogin: boolean;
}
