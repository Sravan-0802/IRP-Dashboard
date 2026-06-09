export interface Track {
  name: string;
  emoji: string;
  level: 1 | 2 | 3;
  courses: string[];
}

export const TRACKS: Track[] = [
  {
    name: "Frontend Track",
    emoji: "⚛️",
    level: 1,
    courses: [
      "Build your own Static Website",
      "Build your own Responsive Website",
      "Modern Responsive Web Design",
      "Build your own Dynamic Web Application",
      "JS Essentials",
      "Getting Started with React JS",
    ],
  },
  {
    name: "Coding Track",
    emoji: "💻",
    level: 1,
    courses: ["Programming Foundations", "DSA — Level 1"],
  },
  {
    name: "Backend Track",
    emoji: "🛠️",
    level: 2,
    courses: ["Introduction to Databases", "DBMS", "Node JS", "MongoDB"],
  },
  {
    name: "Generative AI Track",
    emoji: "🤖",
    level: 2,
    courses: ["Generative AI"],
  },
  {
    name: "DSA Track",
    emoji: "🧠",
    level: 3,
    courses: ["DSA — Level 2", "DSA — Level 3", "DSA — Level 4"],
  },
  {
    name: "Practice Platforms",
    emoji: "🏆",
    level: 3,
    courses: ["CodeChef (target rating 1600+)", "LeetCode (supporting)"],
  },
];
