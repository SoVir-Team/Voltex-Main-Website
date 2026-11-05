import { Router } from "express";
import { z } from "zod";
import { IDEA_SERVICES, IDEA_STAGES, indianPhone } from "@voltex/shared";
import { prisma } from "../db.ts";
import { badRequest, handler } from "../lib/http.ts";

export const enquiriesRouter = Router();

const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .default("")
  .transform((v, ctx) => {
    if (!v) return "";
    const phone = indianPhone(v);
    if (!phone) ctx.addIssue({ code: "custom", message: "Enter a 10-digit phone number, or leave it empty." });
    return phone;
  });

const person = {
  name: z.string().trim().min(1, "Your name is required.").max(120),
  email: z.string().trim().toLowerCase().email("A valid email address is required.").max(160),
  phone: optionalPhone,
  company: z.string().trim().max(160).optional().default(""),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0, "Spam detected.").optional(),
};

const ideaSchema = z.object({
  ...person,
  stage: z.enum(IDEA_STAGES, { message: "Tell us how far along the idea is." }),
  services: z.array(z.enum(IDEA_SERVICES)).max(IDEA_SERVICES.length).default([]),
  quantity: z.string().trim().max(60).optional().default(""),
  timeline: z.string().trim().max(60).optional().default(""),
  description: z.string().trim().min(20, "Describe the idea in at least 20 characters.").max(4000),
  ndaRequested: z.boolean().optional().default(false),
});

const contactSchema = z.object({
  ...person,
  subject: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(10, "Write a message of at least 10 characters.").max(4000),
});

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw badRequest(r.error.issues.map((i) => i.message));
  return r.data;
}

enquiriesRouter.post(
  "/ideas",
  handler(async (req, res) => {
    const { website: _hp, ...data } = parse(ideaSchema, req.body);
    const idea = await prisma.ideaSubmission.create({ data: { ...data, services: [...data.services] } });
    res.status(201).json({ message: "Thanks — your idea is with our engineering team.", id: idea.id });
  }),
);

enquiriesRouter.post(
  "/contact",
  handler(async (req, res) => {
    const { website: _hp, ...data } = parse(contactSchema, req.body);
    const msg = await prisma.contactMessage.create({ data });
    res.status(201).json({ message: "Thanks — we will reply within one working day.", id: msg.id });
  }),
);
