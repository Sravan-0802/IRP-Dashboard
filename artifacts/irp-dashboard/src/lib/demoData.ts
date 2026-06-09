import type {
  Student,
  StudentProgress,
  StudentActivity,
} from "@workspace/api-client-react";

export const DEMO_STUDENT: Student = {
  id: 1,
  name: "Sravan",
  yog: 2028,
  level: "Level 1 • The Hustler",
  email: "176f6f8e-ff20-41d0-a2e8-b7e7e6c3a0c5@academy.local",
  avatar: "",
  registrationStatus: "registered",
  currentLevel: 1,
};

export const DEMO_PROGRESS: StudentProgress = {
  overallMcqPercentage: 69,
  overallCodingPercentage: 49,
  streakDays: 11,
  lastActiveDate: "2026-05-29",
  subjects: [
    {
      subject: "HTML & CSS",
      mcqCompleted: 28,
      mcqTotal: 30,
      codingCompleted: 14,
      codingTotal: 18,
      mcqPercentage: 93,
      codingPercentage: 78,
    },
    {
      subject: "JavaScript Essentials",
      mcqCompleted: 22,
      mcqTotal: 30,
      codingCompleted: 11,
      codingTotal: 20,
      mcqPercentage: 73,
      codingPercentage: 55,
    },
    {
      subject: "React JS",
      mcqCompleted: 16,
      mcqTotal: 30,
      codingCompleted: 7,
      codingTotal: 15,
      mcqPercentage: 53,
      codingPercentage: 47,
    },
    {
      subject: "Python Fundamentals",
      mcqCompleted: 18,
      mcqTotal: 25,
      codingCompleted: 9,
      codingTotal: 20,
      mcqPercentage: 72,
      codingPercentage: 45,
    },
    {
      subject: "Data Structures & Algorithms",
      mcqCompleted: 12,
      mcqTotal: 25,
      codingCompleted: 5,
      codingTotal: 20,
      mcqPercentage: 48,
      codingPercentage: 25,
    },
  ],
};

export const DEMO_ACTIVITY: StudentActivity = {
  totalMcqSolved: 236,
  totalCodingSolved: 82,
  weeklyActivity: [
    { day: "Mon", mcq: 12, coding: 3 },
    { day: "Tue", mcq: 18, coding: 5 },
    { day: "Wed", mcq: 8, coding: 2 },
    { day: "Thu", mcq: 22, coding: 6 },
    { day: "Fri", mcq: 15, coding: 4 },
    { day: "Sat", mcq: 30, coding: 8 },
    { day: "Sun", mcq: 10, coding: 3 },
  ],
  recentSessions: [],
};
