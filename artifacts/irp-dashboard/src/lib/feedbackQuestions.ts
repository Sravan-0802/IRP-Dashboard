export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface FeedbackTier {
  rating: FeedbackRating;
  stars: string;
  label: string;
  questions: string[];
}

export const FEEDBACK_TIERS: FeedbackTier[] = [
  {
    rating: 1,
    stars: "⭐",
    label: "Very dissatisfied",
    questions: [
      "What went wrong with the dashboard?",
      "Which section or feature frustrated you the most?",
      "Was the information difficult to find or understand?",
      "Did the dashboard fail to meet any specific expectation you had?",
      "What would you need to see for this to be useful to you?",
    ],
  },
  {
    rating: 2,
    stars: "⭐⭐",
    label: "Dissatisfied",
    questions: [
      "What didn't work well for you?",
      "Was there anything confusing or unclear on the dashboard?",
      "Did you feel like any important information was missing?",
      "Which part of the dashboard felt incomplete or unhelpful?",
      "What's the one thing we should fix first?",
    ],
  },
  {
    rating: 3,
    stars: "⭐⭐⭐",
    label: "Neutral",
    questions: [
      "What did you like about the dashboard?",
      "What felt average or could be better?",
      "Was there anything that slowed you down or felt unnecessary?",
      "What would make this a 4 or 5 star experience for you?",
      "Is there a feature you expected but didn't find?",
    ],
  },
  {
    rating: 4,
    stars: "⭐⭐⭐⭐",
    label: "Satisfied",
    questions: [
      "What did you enjoy most about the dashboard?",
      "What's the one thing that stopped you from giving 5 stars?",
      "Was there anything that felt slightly off or could be smoother?",
      "Is there a feature you'd love to see added?",
      "How easy was it to navigate and find what you needed?",
    ],
  },
  {
    rating: 5,
    stars: "⭐⭐⭐⭐⭐",
    label: "Very satisfied",
    questions: [
      "What did you love most about the dashboard?",
      "Which feature or section was the most useful to you?",
      "Is there anything we could add to make it even better?",
      "Would you recommend this dashboard to your peers? Why?",
      "Any other thoughts you'd like to share with us?",
    ],
  },
];

export function feedbackTierForRating(rating: FeedbackRating): FeedbackTier {
  return FEEDBACK_TIERS.find((t) => t.rating === rating)!;
}
