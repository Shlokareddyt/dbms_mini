"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Briefcase, GraduationCap, Loader2, UserPlus } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";

interface SkillOption {
  skill_id: number;
  name: string;
  category: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();

  const [role, setRole] = useState<"student" | "alumni">("student");
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Student fields
  const [major, setMajor] = useState("");
  const [studentGradYear, setStudentGradYear] = useState("2027");
  const [studentBio, setStudentBio] = useState("");
  const [careerGoals, setCareerGoals] = useState("");

  // Alumni fields
  const [currentCompany, setCurrentCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [alumniGradYear, setAlumniGradYear] = useState("2021");
  const [alumniBio, setAlumniBio] = useState("");
  const [menteeCapacity, setMenteeCapacity] = useState("3");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/skills")
      .then((res) => (res.ok ? res.json() : { skills: [] }))
      .then((data) => {
        if (active && Array.isArray(data.skills)) {
          setSkills(data.skills);
        }
      })
      .catch(() => {
        // Skills catalog optional before DB seed
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleSkill(skillId: number) {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  }

  function validateForm(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) {
      next.name = "Full name must be at least 2 characters.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }

    if (role === "student") {
      if (major.trim().length < 2) {
        next.major = "Major / branch is required.";
      }
      const yr = Number(studentGradYear);
      if (!Number.isInteger(yr) || yr < 2020 || yr > 2035) {
        next.studentGradYear = "Enter a graduation year between 2020 and 2035.";
      }
    } else {
      if (currentCompany.trim().length < 2) {
        next.currentCompany = "Current company is required.";
      }
      if (jobTitle.trim().length < 2) {
        next.jobTitle = "Job title is required.";
      }
      if (industry.trim().length < 2) {
        next.industry = "Industry is required.";
      }
      const yr = Number(alumniGradYear);
      if (!Number.isInteger(yr) || yr < 1970 || yr > 2030) {
        next.alumniGradYear = "Enter a graduation year between 1970 and 2030.";
      }
      if (alumniBio.trim().length < 15) {
        next.alumniBio =
          "Please write at least 15 characters in your bio for mentor matching.";
      }
      const cap = Number(menteeCapacity);
      if (!Number.isInteger(cap) || cap < 0 || cap > 20) {
        next.menteeCapacity = "Capacity must be an integer between 0 and 20.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the highlighted form fields.", "Validation Error");
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        role === "student"
          ? {
              role: "student",
              name: name.trim(),
              email: email.trim(),
              password,
              major: major.trim(),
              grad_year: Number(studentGradYear),
              bio: studentBio.trim(),
              career_goals: careerGoals.trim(),
              skill_ids: selectedSkillIds,
            }
          : {
              role: "alumni",
              name: name.trim(),
              email: email.trim(),
              password,
              current_company: currentCompany.trim(),
              job_title: jobTitle.trim(),
              industry: industry.trim(),
              grad_year: Number(alumniGradYear),
              bio: alumniBio.trim(),
              mentee_capacity: Number(menteeCapacity),
              skill_ids: selectedSkillIds,
            };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          data.error || "Registration failed.",
          data.code === "ER_DUP_ENTRY" ? "Duplicate Email" : "Registration Error"
        );
        return;
      }

      toast.success("Account created! Redirecting to your dashboard...");
      router.push(`/dashboard/${data.user.role}`);
      router.refresh();
    } catch {
      toast.error("Network error during registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={null} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create your AlumniHub account
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Choose your role to configure your relational profile in MySQL.
            </p>
          </div>

          {/* Role Toggle */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setRole("student");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                role === "student"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Student
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("alumni");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                role === "alumni"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Alumni Mentor
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Suhas Srinath"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@pes.edu"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password (min 8 chars) *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {role === "student" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Major / Specialization *
                    </label>
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      placeholder="CSE (AI & ML)"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {errors.major && (
                      <p className="mt-1 text-xs text-red-600">{errors.major}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Expected Graduation Year *
                    </label>
                    <input
                      type="number"
                      value={studentGradYear}
                      onChange={(e) => setStudentGradYear(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {errors.studentGradYear && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.studentGradYear}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Career Goals
                  </label>
                  <textarea
                    rows={2}
                    value={careerGoals}
                    onChange={(e) => setCareerGoals(e.target.value)}
                    placeholder="Interested in ML systems, backend architecture, and early-stage AI startups..."
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Short Bio
                  </label>
                  <textarea
                    rows={2}
                    value={studentBio}
                    onChange={(e) => setStudentBio(e.target.value)}
                    placeholder="3rd year CS student building distributed database and LLM projects."
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Current Company *
                    </label>
                    <input
                      type="text"
                      value={currentCompany}
                      onChange={(e) => setCurrentCompany(e.target.value)}
                      placeholder="Google / Razorpay / Startup"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {errors.currentCompany && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.currentCompany}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Senior ML Engineer"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {errors.jobTitle && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.jobTitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Industry *
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="AI & Cloud"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {errors.industry && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.industry}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Graduation Year *
                    </label>
                    <input
                      type="number"
                      value={alumniGradYear}
                      onChange={(e) => setAlumniGradYear(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {errors.alumniGradYear && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.alumniGradYear}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Mentee Capacity *
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={menteeCapacity}
                      onChange={(e) => setMenteeCapacity(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    />
                    {errors.menteeCapacity && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.menteeCapacity}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Mentorship Bio * (used for semantic mentor matching)
                  </label>
                  <textarea
                    rows={3}
                    value={alumniBio}
                    onChange={(e) => setAlumniBio(e.target.value)}
                    placeholder="Describe your domain expertise, startup/engineering experience, and topics you mentor students on..."
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                  />
                  {errors.alumniBio && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.alumniBio}
                    </p>
                  )}
                </div>
              </>
            )}

            {skills.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {role === "student"
                    ? "Skills You Want to Learn"
                    : "Areas of Expertise"}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skills.map((skill) => {
                    const selected = selectedSkillIds.includes(skill.skill_id);
                    return (
                      <button
                        key={skill.skill_id}
                        type="button"
                        onClick={() => toggleSkill(skill.skill_id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selected
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        {skill.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Register as {role === "student" ? "Student" : "Alumni"}
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

