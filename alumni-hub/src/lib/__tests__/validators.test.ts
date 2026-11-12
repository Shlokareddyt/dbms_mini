import { describe, expect, it } from "vitest";
import {
  createFeedbackSchema,
  createMentorshipRequestSchema,
  loginSchema,
  registerSchema,
  semanticSearchSchema,
  updateMentorshipRequestSchema,
} from "@/lib/validators";

describe("loginSchema", () => {
  it("accepts a valid email/password pair", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema (discriminated union)", () => {
  it("requires student-only fields when role=student", () => {
    const result = registerSchema.safeParse({
      role: "student",
      name: "Aarav Sharma",
      email: "aarav@pes.edu",
      password: "password123",
      major: "CSE",
      grad_year: 2027,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an alumni payload with too short a bio (bio drives vector matching quality)", () => {
    const result = registerSchema.safeParse({
      role: "alumni",
      name: "Ananya Rao",
      email: "ananya@alumni.pes.edu",
      password: "password123",
      current_company: "Sarvam AI",
      job_title: "ML Engineer",
      industry: "AI",
      grad_year: 2020,
      bio: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown role", () => {
    const result = registerSchema.safeParse({
      role: "admin",
      name: "x",
      email: "x@x.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("createMentorshipRequestSchema", () => {
  it("defaults message to empty string when omitted", () => {
    const result = createMentorshipRequestSchema.parse({ alumni_id: 5 });
    expect(result.message).toBe("");
  });

  it("rejects a non-positive alumni_id", () => {
    const result = createMentorshipRequestSchema.safeParse({ alumni_id: 0 });
    expect(result.success).toBe(false);
  });

  it("clamps match_score to [0, 1]", () => {
    expect(
      createMentorshipRequestSchema.safeParse({ alumni_id: 1, match_score: 1.5 }).success
    ).toBe(false);
    expect(
      createMentorshipRequestSchema.safeParse({ alumni_id: 1, match_score: 0.87 }).success
    ).toBe(true);
  });
});

describe("updateMentorshipRequestSchema", () => {
  it("only allows the four defined lifecycle actions", () => {
    for (const action of ["accept", "reject", "cancel", "complete"]) {
      expect(updateMentorshipRequestSchema.safeParse({ action }).success).toBe(true);
    }
    expect(updateMentorshipRequestSchema.safeParse({ action: "approve" }).success).toBe(false);
  });
});

describe("createFeedbackSchema", () => {
  it("enforces a 1-5 integer rating", () => {
    expect(createFeedbackSchema.safeParse({ session_id: 1, rating: 5 }).success).toBe(true);
    expect(createFeedbackSchema.safeParse({ session_id: 1, rating: 0 }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ session_id: 1, rating: 6 }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ session_id: 1, rating: 3.5 }).success).toBe(false);
  });
});

describe("semanticSearchSchema", () => {
  it("rejects queries shorter than 5 characters", () => {
    expect(semanticSearchSchema.safeParse({ query: "hi" }).success).toBe(false);
  });

  it("defaults top_k to 3", () => {
    const result = semanticSearchSchema.parse({ query: "backend mentor please" });
    expect(result.top_k).toBe(3);
  });
});
