import type {
  Student,
  StudentProgress,
  StudentActivity,
} from "@workspace/api-client-react";

export const DEMO_STUDENT: Student = {
  id: 1,
  name: "Arjun Sharma",
  yog: 2028,
  level: "Level 1 • The Hustler",
  email: "arjun.sharma@example.com",
  avatar: "",
  registrationStatus: "registered",
  currentLevel: 1,
};

export const DEMO_PROGRESS: StudentProgress = {
  overallMcqPercentage: 68,
  overallCodingPercentage: 54,
  streakDays: 7,
  lastActiveDate: "2026-06-04",
  subjects: [
    {
      subject: "HTML & CSS",
      mcqCompleted: 42,
      mcqTotal: 60,
      codingCompleted: 18,
      codingTotal: 30,
      mcqPercentage: 70,
      codingPercentage: 60,
    },
    {
      subject: "JavaScript Essentials",
      mcqCompleted: 35,
      mcqTotal: 50,
      codingCompleted: 12,
      codingTotal: 25,
      mcqPercentage: 70,
      codingPercentage: 48,
    },
    {
      subject: "Python Fundamentals",
      mcqCompleted: 28,
      mcqTotal: 45,
      codingCompleted: 10,
      codingTotal: 20,
      mcqPercentage: 62,
      codingPercentage: 50,
    },
  ],
};

export const DEMO_ACTIVITY: StudentActivity = {
  totalMcqSolved: 105,
  totalCodingSolved: 40,
  weeklyActivity: [
    { day: "Mon", mcq: 12, coding: 4 },
    { day: "Tue", mcq: 18, coding: 6 },
    { day: "Wed", mcq: 8, coding: 3 },
    { day: "Thu", mcq: 22, coding: 8 },
    { day: "Fri", mcq: 15, coding: 5 },
    { day: "Sat", mcq: 20, coding: 7 },
    { day: "Sun", mcq: 10, coding: 7 },
  ],
  recentSessions: [],
};
