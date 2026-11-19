/** Placement Eligibility FAQs — content from the NxtWave placement team's FAQ page. */

export type FaqBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "link"; label: string; url: string };

export type FaqItem = { q: string; a: FaqBlock[] };

export type FaqTopic = { id: string; label: string; items: FaqItem[] };

export const FAQ_TOPICS: FaqTopic[] = [
  {
    "id": "eligibility-access",
    "label": "Eligibility & access",
    "items": [
      {
        "q": "Who is eligible for internship opportunities?",
        "a": [
          {
            "type": "p",
            "text": "Internships are open to 2028, 2029 & 2030 graduates. Students must qualify through at least one of the following tracks."
          },
          {
            "type": "p",
            "text": "IRP MERN Track: Students must have successfully cleared the Frontend (FE) Project in the IRP MERN Track."
          },
          {
            "type": "p",
            "text": "GenAI Track: Students must have submitted GenAI projects (at least 2 projects) and successfully cleared the GenAI Assessment."
          }
        ]
      },
      {
        "q": "I got an email saying I am eligible, but my Job Board says “No opportunities available”. Why?",
        "a": [
          {
            "type": "p",
            "text": "Eligible students were given Job Board access in October, but the number of internship openings this month is limited. So even with access, you may not see any openings yet. More opportunities are expected on the Job Board from next month."
          }
        ]
      },
      {
        "q": "The Apply Now button is disabled for an opening. What does that mean?",
        "a": [
          {
            "type": "p",
            "text": "Each opening has its own eligibility requirements. If Apply Now is disabled, check that opening’s criteria. Your Job Board may also be on hold after an offer. If you believe you meet every criterion, raise a ticket with your UID and a screenshot of the opening."
          }
        ]
      },
      {
        "q": "Do I need an NOC from my college?",
        "a": [
          {
            "type": "p",
            "text": "Companies expect you to commit to the internship for its full duration, so you may need permission or a No Objection Certificate (NOC) from your college before joining. Arrange it before you accept an offer. If your college refuses, contact the placement team before you accept or decline the offer."
          }
        ]
      },
      {
        "q": "After my internship, will NxtWave help me find a full-time job?",
        "a": [
          {
            "type": "p",
            "text": "Yes. After you complete your internship, NxtWave provides full-time job opportunities based on your graduation year."
          }
        ]
      },
      {
        "q": "Why is my Job Board access restricted after receiving or accepting an internship offer?",
        "a": [
          {
            "type": "p",
            "text": "Job Board access is restricted for six months during the internship period to encourage students to gain meaningful internship experience and complete their internship commitment without discontinuing it midway."
          }
        ]
      },
      {
        "q": "How can I regain Job Board access if my internship has ended or been discontinued?",
        "a": [
          {
            "type": "p",
            "text": "Under the current policy, Job Board access is restricted for six months during the internship period. If your internship has ended early or has been discontinued, please contact the concerned support or placement team to clarify the process for restoring your Job Board access."
          }
        ]
      }
    ]
  },
  {
    "id": "irp-2-0-assessments-mock-interviews",
    "label": "IRP 2.0 assessments & mock interviews",
    "items": [
      {
        "q": "What are the stages of IRP 2.0?",
        "a": [
          {
            "type": "p",
            "text": "IRP 2.0 runs in three levels, and you move up only after clearing every step of the current one. Level 1, The Hustler, is your entry point and covers foundational frontend and programming:"
          },
          {
            "type": "ul",
            "items": [
              "L1 assessment (about 2 hours): JS Coding (90 minutes, easy) and HTML, CSS, JavaScript & React (MCQ, 30 minutes).",
              "FE Project: 12 hours.",
              "Human mock interview: 1 hour."
            ]
          }
        ]
      },
      {
        "q": "I cleared the FE Project weeks ago and still have no human mock interview slot. What should I do?",
        "a": [
          {
            "type": "p",
            "text": "If you are eligible, you will receive a nudge to fill in your availability for a slot. If you are not eligible, this will show on your IRP Student Dashboard. If you are eligible and have not received the link yet, please wait. Every eligible student will get a link."
          }
        ]
      },
      {
        "q": "My human mock interview was cancelled, the link never came, or I missed it. Will it be rescheduled?",
        "a": [
          {
            "type": "p",
            "text": "Yes, a link will be sent. If you missed the slot from your side, you get only one more opportunity to complete it. Action will be taken against you if you fail to turn up for your interview slot."
          }
        ]
      },
      {
        "q": "I got an email saying I cleared L1, but my IRP dashboard still shows L1 human interview prep. Which is correct?",
        "a": [
          {
            "type": "p",
            "text": "Your dashboard will be updated soon with all human interview scores. We are currently adding human interview data to the IRP dashboard."
          }
        ]
      },
      {
        "q": "I did not clear my human mock interview. What happens next?",
        "a": [
          {
            "type": "p",
            "text": "You will receive a re-attempt link, so you get another chance if you do not clear it."
          }
        ]
      },
      {
        "q": "When will I get my FE Project or assessment result?",
        "a": [
          {
            "type": "p",
            "text": "Results are sent by email and reflected on your IRP dashboard. Check your dashboard regularly."
          }
        ]
      },
      {
        "q": "Will I get feedback on why I did not clear a round?",
        "a": [
          {
            "type": "p",
            "text": "Your scores for each attempt are shown on your dashboard. Work on the areas where your scores are lower."
          }
        ]
      }
    ]
  },
  {
    "id": "genai-track",
    "label": "GenAI track",
    "items": [
      {
        "q": "How does the GenAI track lead to internships?",
        "a": [
          {
            "type": "p",
            "text": "Follow these steps on your Learning Portal:"
          },
          {
            "type": "ol",
            "items": [
              "Complete all classes of GenAI Training for Internships in Live Classes.",
              "Attend the upcoming GenAI Assessment and clear it.",
              "Complete your project submissions (at least 2 GenAI projects)."
            ]
          },
          {
            "type": "p",
            "text": "Clearing the assessment and submitting at least 2 projects makes you eligible for internship opportunities. You can qualify through the GenAI track, the IRP MERN track, or both."
          }
        ]
      },
      {
        "q": "I took a GenAI Assessment and have no result yet. What should I do?",
        "a": [
          {
            "type": "p",
            "text": "Check your email, as a result mail will be sent soon. We are also updating these results on the student dashboard, where they will be visible within a week."
          }
        ]
      },
      {
        "q": "I have no update on my GenAI human interview, or it was cancelled. What should I do?",
        "a": [
          {
            "type": "p",
            "text": "GenAI human interviews (including NxtMock interviews) are still being conducted. Once they are complete for all students, results will show on your IRP Dashboard, so please be patient."
          },
          {
            "type": "p",
            "text": "If your interview was cancelled from our side, raise a ticket with your UID and the dates of the cancelled slots so it can be prioritised. If it was cancelled from your side, you will not get another chance, and action will be taken against you."
          }
        ]
      },
      {
        "q": "Any questions regarding GenAI or MERN?",
        "a": [
          {
            "type": "p",
            "text": "Attend the live training sessions and bring your doubts there. You can also ask in the NxtWave Discord community. When you ask, mention the topic or project and the exact part you are stuck on, so you get a faster answer."
          }
        ]
      }
    ]
  },
  {
    "id": "applications-interviews",
    "label": "Applications & interviews",
    "items": [
      {
        "q": "What internship roles, companies, and stipend ranges are available?",
        "a": [
          {
            "type": "p",
            "text": "Internship stipends generally start at ₹5,000 per month. The maximum stipend depends on the company and the role. Some companies may offer stipends exceeding ₹25,000 per month."
          }
        ]
      },
      {
        "q": "Why am I not receiving responses after applying to multiple companies?",
        "a": [
          {
            "type": "p",
            "text": "If you have not received an update after applying, your profile may not have been shortlisted or may have been rejected during the resume-screening stage. Going forward, we will try to provide updates when your profile is rejected."
          }
        ]
      },
      {
        "q": "Why do companies reject my application without providing assessment results or feedback?",
        "a": [
          {
            "type": "p",
            "text": "Your resume plays an important role in getting shortlisted by a company. Focus on building a strong resume that highlights your technical skills, relevant projects, and achievements to improve your chances of progressing through the screening process."
          }
        ]
      },
      {
        "q": "If I have been shortlisted for a company, when will the interview take place?",
        "a": [
          {
            "type": "p",
            "text": "The interview timeline varies from company to company. Some companies complete their interview process within a day or a week, while others may take more than a month. If you have not received an update for over a month, the company’s hiring requirement may have been closed or the position may have been filled."
          }
        ]
      },
      {
        "q": "How can I track the status of my job or internship applications?",
        "a": [
          {
            "type": "p",
            "text": "You can track the status of your job and internship applications through the Application Status Dashboard."
          }
        ]
      },
      {
        "q": "Can students receive feedback to understand why their applications or assessments were rejected?",
        "a": [
          {
            "type": "p",
            "text": "Yes. We will share feedback to help you understand the stage at which your application or assessment was unsuccessful."
          }
        ]
      },
      {
        "q": "Can students receive personalised resume reviews and mock interview sessions?",
        "a": [
          {
            "type": "p",
            "text": "Yes. Students can use the Resume Tool Maker to improve their resumes. Mentors can also connect with students one-on-one upon request. In addition, regular resume guidance sessions are conducted to help students identify areas for improvement."
          },
          {
            "type": "link",
            "label": "Resume Tool",
            "url": "https://nxtresume.ccbp.in/"
          }
        ]
      },
      {
        "q": "How can students improve their chances of getting shortlisted and converting interviews into offers?",
        "a": [
          {
            "type": "p",
            "text": "Focus on the following areas:"
          },
          {
            "type": "ul",
            "items": [
              "A strong resume: Highlight your technical skills, relevant experience, and achievements.",
              "Good projects: Build meaningful projects that demonstrate your practical skills.",
              "Clear project explanations: Be prepared to explain your project architecture, decisions, challenges, and solutions.",
              "Problem-solving skills: Understand the problem before attempting to solve it, and explain your approach logically.",
              "Communication skills: Communicate your thought process and solutions clearly during interviews."
            ]
          }
        ]
      },
      {
        "q": "Will placement opportunities be available for specialised roles such as AI Engineer, Data Analyst, and Cybersecurity/SOC Analyst?",
        "a": [
          {
            "type": "p",
            "text": "Approximately 80% of job opportunities are expected to be in areas such as MERN Stack, AI/ML, Generative AI, Frontend, and Backend development. The remaining 10% of opportunities are expected to cover other technology stacks."
          }
        ]
      },
      {
        "q": "Can students receive the official company profile, website, job description, stipend, and employment terms before applying?",
        "a": [
          {
            "type": "p",
            "text": "Yes. Company and role-related details, including the job description and available employment information, can be reviewed in the Job Board posting before applying."
          }
        ]
      },
      {
        "q": "Why are similar roles or opportunities from the same company repeatedly posted on the Job Board?",
        "a": [
          {
            "type": "p",
            "text": "NxtWave works with multiple companies. When a company finds students with the required skills and strong projects, it may continue recruiting additional students through NxtWave. As a result, the same company may post similar roles or recruit multiple students."
          }
        ]
      },
      {
        "q": "Why have I not received my official offer letter after being informed that I was selected?",
        "a": [
          {
            "type": "p",
            "text": "After selection, the offer letter is generally expected within a week. If you do not receive it within that period, you may receive a selection email from the company, followed by further onboarding communication."
          }
        ]
      }
    ]
  },
  {
    "id": "offline-competency-assessments",
    "label": "Offline competency assessments",
    "items": [
      {
        "q": "Can students follow the previous placement eligibility process instead of the newly introduced assessment requirements?",
        "a": [
          {
            "type": "p",
            "text": "Students in Roles A, B, and C can directly take the offline competency assessments. Role A students are directly eligible for DSA Technical Interviews, while Role B students are directly eligible for Frontend Technical Interviews."
          }
        ]
      },
      {
        "q": "Why are placement assessments requiring repeated travel to cities such as Hyderabad, Bengaluru, and Chennai?",
        "a": [
          {
            "type": "p",
            "text": "Most eligible students are concentrated in these locations. Assessment centres are planned based on the eligible student pool to make assessments accessible to as many students as possible."
          }
        ]
      },
      {
        "q": "Can multiple assessments be scheduled on the same day to reduce travel expenses?",
        "a": [
          {
            "type": "p",
            "text": "Yes. Four assessments are conducted on the same day, and students can choose to take any two assessments based on their eligibility and preparation."
          }
        ]
      },
      {
        "q": "Can offline assessments be conducted more frequently, such as every two weeks?",
        "a": [
          {
            "type": "p",
            "text": "Offline competency assessments are already conducted approximately every two weeks. However, schedules may need to be adjusted around college semester examinations, festivals, and other student availability constraints."
          }
        ]
      },
      {
        "q": "Can assessment centres be established in more cities or closer to students’ hometowns?",
        "a": [
          {
            "type": "p",
            "text": "We are planning to expand assessment locations based on the eligible student pool to cover more students and improve accessibility."
          }
        ]
      },
      {
        "q": "Can offline competency assessments be conducted online with secure proctoring?",
        "a": [
          {
            "type": "p",
            "text": "Currently, offline competency assessments cannot be conducted online. Students are required to attend in person at the designated assessment centres."
          }
        ]
      },
      {
        "q": "Why are offline competency assessments mandatory when students live far away from assessment centres?",
        "a": [
          {
            "type": "p",
            "text": "Offline competency assessments are part of the placement eligibility process. Students can plan to attend when an assessment is conducted at a location closer to them."
          }
        ]
      }
    ]
  }
];
