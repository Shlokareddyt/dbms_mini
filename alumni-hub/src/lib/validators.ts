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

