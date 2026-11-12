import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const baseRegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(120, "Name cannot exceed 120 characters."),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(255, "Email cannot exceed 255 characters."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(100, "Password cannot exceed 100 characters."),
  role: z.enum(["student", "alumni"]),
});

export const studentRegisterSchema = baseRegisterSchema.extend({
  role: z.literal("student"),
  major: z
    .string()
    .trim()
    .min(2, "Major/branch is required.")
    .max(100, "Major cannot exceed 100 characters."),
  grad_year: z.coerce
    .number()
    .int()
    .min(2020, "Graduation year must be 2020 or later.")
    .max(2035, "Graduation year must be 2035 or earlier."),
  bio: z
    .string()
    .trim()
    .max(2000, "Bio cannot exceed 2000 characters.")
    .optional()
    .default(""),
  career_goals: z
    .string()
    .trim()
    .max(2000, "Career goals cannot exceed 2000 characters.")
    .optional()
    .default(""),
  skill_ids: z.array(z.number().int().positive()).optional().default([]),
});

export const alumniRegisterSchema = baseRegisterSchema.extend({
  role: z.literal("alumni"),
  current_company: z
    .string()
    .trim()
    .min(2, "Current company is required.")
    .max(150, "Company name cannot exceed 150 characters."),
  job_title: z
    .string()
    .trim()
    .min(2, "Job title is required.")
    .max(150, "Job title cannot exceed 150 characters."),
  industry: z
    .string()
    .trim()
    .min(2, "Industry is required.")
    .max(100, "Industry cannot exceed 100 characters."),
  grad_year: z.coerce
    .number()
    .int()
    .min(1970, "Graduation year must be 1970 or later.")
    .max(2030, "Graduation year must be 2030 or earlier."),
  bio: z
    .string()
    .trim()
    .min(15, "Please provide a brief bio (at least 15 characters) for mentorship matching.")
    .max(3000, "Bio cannot exceed 3000 characters."),
  mentee_capacity: z.coerce
    .number()
    .int()
    .min(0, "Mentee capacity cannot be negative.")
    .max(20, "Mentee capacity cannot exceed 20.")
    .default(3),
  skill_ids: z.array(z.number().int().positive()).optional().default([]),
});

export const registerSchema = z.discriminatedUnion("role", [
  studentRegisterSchema,
  alumniRegisterSchema,
]);

// ---------------------------------------------------------------------------
// Phase 2 — Mentorship workflow validators
// ---------------------------------------------------------------------------

export const createMentorshipRequestSchema = z.object({
  alumni_id: z.coerce.number().int().positive("A valid mentor must be selected."),
  message: z
    .string()
    .trim()
    .max(1000, "Message cannot exceed 1000 characters.")
    .optional()
    .default(""),
  match_score: z.coerce.number().min(0).max(1).optional(),
});

export const updateMentorshipRequestSchema = z.object({
  action: z.enum(["accept", "reject", "cancel", "complete"]),
});

export const createSessionSchema = z.object({
  request_id: z.coerce.number().int().positive(),
  scheduled_at: z.string().trim().min(1, "A scheduled date/time is required."),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(15, "Sessions must be at least 15 minutes.")
    .max(240, "Sessions cannot exceed 240 minutes.")
    .default(30),
  meeting_link: z
    .string()
    .trim()
    .max(500, "Meeting link cannot exceed 500 characters.")
    .optional()
    .default(""),
});

export const updateSessionSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  notes: z.string().trim().max(2000).optional(),
  scheduled_at: z.string().trim().optional(),
  meeting_link: z.string().trim().max(500).optional(),
});

export const createFeedbackSchema = z.object({
  session_id: z.coerce.number().int().positive(),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
  comments: z
    .string()
    .trim()
    .max(1500, "Comments cannot exceed 1500 characters.")
    .optional()
    .default(""),
});

export const createInsightSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters.")
    .max(200, "Title cannot exceed 200 characters."),
  content: z
    .string()
    .trim()
    .min(30, "Content must be at least 30 characters.")
    .max(8000, "Content cannot exceed 8000 characters."),
  skill_ids: z.array(z.number().int().positive()).optional().default([]),
});

export const updateAlumniProfileSchema = z.object({
  current_company: z.string().trim().min(2).max(150).optional(),
  job_title: z.string().trim().min(2).max(150).optional(),
  industry: z.string().trim().min(2).max(100).optional(),
  bio: z.string().trim().min(15).max(3000).optional(),
  mentee_capacity: z.coerce.number().int().min(0).max(20).optional(),
  skill_ids: z.array(z.number().int().positive()).optional(),
});

export const updateStudentProfileSchema = z.object({
  major: z.string().trim().min(2).max(100).optional(),
  grad_year: z.coerce.number().int().min(2020).max(2035).optional(),
  bio: z.string().trim().max(2000).optional(),
  career_goals: z.string().trim().max(2000).optional(),
  skill_ids: z.array(z.number().int().positive()).optional(),
});

export const semanticSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(5, "Describe what kind of mentor you're looking for (at least 5 characters)."),
  top_k: z.coerce.number().int().min(1).max(10).optional().default(3),
});

export const verifyUserSchema = z.object({
  is_verified: z.boolean(),
});
