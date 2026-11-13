/**
 * Courses and practice resources per IRP level, from the "Student Dashboard:
 * Levels & Courses" brief. Destinations are configured here and never built
 * from course names.
 */
export type CourseLink = { name: string; url: string };

export type CourseTrack = { title: string; items: CourseLink[] };

export type LevelCourses = {
  level: 1 | 2 | 3;
  label: string;
  heading: string;
  tracks: CourseTrack[];
};

export const LEVEL_COURSES: LevelCourses[] = [
  {
    level: 1,
    label: "L1",
    heading: "Frontend & Programming",
    tracks: [
      {
        title: "Frontend Track",
        items: [
          { name: "HTML, CSS", url: "https://learning.ccbp.in/course?c_id=cf46b992-3227-4074-84b2-f6867a00360d" },
          {
            name: "Build your own Dynamic Web Application",
            url: "https://learning.ccbp.in/cl-course/c0d9b357-87a7-41e2-985f-affaef636499",
          },
          { name: "JS Essentials", url: "https://learning.ccbp.in/cl-course/7e0446da-981d-4faa-b02d-f4dc605dba66" },
          {
            name: "Getting Started with React JS",
            url: "https://learning.ccbp.in/cl-course/40ab5ebd-3def-4faf-adca-3d39d921df1c",
          },
        ],
      },
      {
        title: "Coding Track",
        items: [
          {
            name: "Programming Foundations",
            url: "https://learning.ccbp.in/cl-course/c6008f8d-cd91-4843-bb3f-b75d4beca046",
          },
          { name: "DSA - Level 1", url: "https://learning.ccbp.in/course?c_id=058b97cb-16db-4098-8b1e-3e7cbffe1db4" },
        ],
      },
    ],
  },
  {
    level: 2,
    label: "L2",
    heading: "Backend, Databases & Generative AI",
    tracks: [
      {
        title: "Backend Track",
        items: [
          {
            name: "Introduction to Databases",
            url: "https://learning.ccbp.in/cl-course/25c1a72c-216e-47e1-9bc6-b2f16c66e0ca",
          },
          { name: "DBMS", url: "https://learning.ccbp.in/course?c_id=3ba04d30-7c3a-4d5d-8c23-6e3bfc093511" },
          { name: "Node JS", url: "https://learning.ccbp.in/cl-course/d82d6905-6694-42c4-8c0c-bd2c887c1b53" },
          {
            name: "MongoDB",
            url: "https://learning.ccbp.in/course?c_id=a5777f9b-1a9c-42a5-aab7-0182e80efca2&s_id=f09a898b-f8e3-4ded-a6c7-46184629ff3d&t_id=42d9584b-aee6-4eb6-b1ed-8f8de7a29633",
          },
        ],
      },
      {
        title: "Generative AI Track",
        items: [
          {
            name: "Generative AI",
            url: "https://learning.ccbp.in/course?c_id=b9811b34-585b-47e0-a0be-65f1081a74f2&s_id=64025833-d46d-4e7c-a7e0-a9c230a78b9d&t_id=096cf0ff-cdc5-4efb-9895-7c9aff0dbb1e",
          },
        ],
      },
    ],
  },
  {
    level: 3,
    label: "L3",
    heading: "Infinite Aura — Top 1% Track",
    tracks: [
      {
        title: "DSA",
        items: [
          { name: "DSA — Level 2", url: "https://learning.ccbp.in/course?c_id=229cbe49-f4c4-4aa2-bcc6-55ea3e15e159" },
          {
            name: "DSA — Level 3",
            url: "https://learning.ccbp.in/course?c_id=68d141a9-3a73-4bc3-8d8c-cfff7ec8a4be&s_id=696cf715-22e7-4587-ac63-6c5df7427ad5&t_id=009e5ade-f694-4a42-8dbf-544f06a4da1e",
          },
          { name: "DSA — Level 4", url: "https://learning.ccbp.in/course?c_id=8baa11e3-3e95-4add-ba99-9218414e9a38" },
        ],
      },
      {
        title: "Practice",
        items: [
          { name: "CodeChef (aim for rating > 1600 for L3)", url: "https://www.codechef.com/" },
          { name: "LeetCode (supporting practice)", url: "https://leetcode.com/" },
        ],
      },
    ],
  },
];

/** GenAI Track preparation courses on the learning portal. */
export const GENAI_COURSE_TRACKS: CourseTrack[] = [
  {
    title: "RAG courses",
    items: [
      {
        name: "Intelligent RAG",
        url: "https://learning.ccbp.in/course?c_id=a4664d28-2ad2-4805-b488-53ad888bcb16&t_id=f9e88b8d-7eb0-469e-aeb6-8f32031336ed&s_id=eaa1308f-cb2c-453e-b32e-96021ed00912",
      },
      {
        name: "Agentic RAG",
        url: "https://learning.ccbp.in/course?c_id=a4664d28-2ad2-4805-b488-53ad888bcb16&t_id=383b46a0-7d31-4356-9125-f67632bd9f85&s_id=8e18c25c-8673-46b7-9207-46558ad8a289",
      },
      {
        name: "Building and Optimising Enterprise RAG",
        url: "https://learning.ccbp.in/course?c_id=a4664d28-2ad2-4805-b488-53ad888bcb16&t_id=629d6122-a014-4df0-9b20-c4f206e00870&s_id=f6424c48-5d26-4cee-b327-bcf98fc2bd82",
      },
    ],
  },
];

/** L1 online assessment pattern as stated in the brief. NxtMock is not part of L1. */
export const L1_ASSESSMENT_PATTERN = [
  "HTML, CSS, JavaScript & React MCQ · 30 minutes",
  "JS Coding · 90 minutes · Easy",
] as const;

export function coursesForLevel(level: 1 | 2 | 3): LevelCourses | undefined {
  return LEVEL_COURSES.find((entry) => entry.level === level);
}
