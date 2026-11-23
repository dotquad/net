/** The A+ to F grade on Dotquad's graded checks (TLS, email, the domain report card). */
export type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

/** A grade's color family in the Signal design: good (teal), middling (grey) or bad (amber). */
export type GradeTone = "ok" | "neutral" | "flag";

export const gradeTone = (g: Grade): GradeTone =>
  g === "A+" || g === "A" ? "ok" : g === "B" || g === "C" ? "neutral" : "flag";
