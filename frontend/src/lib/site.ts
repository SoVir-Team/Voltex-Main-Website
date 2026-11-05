// Company facts and copy, taken from the VOLTEX brand profile (PDF). Contact details are placeholders until confirmed.
export const SITE = {
  name: "VOLTEX",
  legalName: "VOLTEX Electronics Private Limited",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  tagline: "Engineering Intelligence. Powering Tomorrow.",
  promise: "From Concept to Circuit. From Design to Reality.",
  description:
    "VOLTEX designs electronic circuits, lays out and fabricates printed circuit boards, and manufactures finished electronics, taking ideas from concept to production.",
  // TODO(client): confirm before launch.
  contact: {
    email: "voltexelectronics2026@gmail.com",
    phone: "+91 88517 71838",
    address: ["VOLTEX Electronics Private Limited", "India"],
    hours: "Monday to Saturday, 9:30 to 18:30 IST",
  },
};

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/our-products", label: "Our products" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const WHO_WE_ARE = [
  "VOLTEX Electronics Private Limited is an electronics engineering, design and manufacturing company focused on developing innovative electronic solutions.",
  "We design electronic circuits, develop PCB layouts, manufacture and print printed circuit boards, and support electronics product development from concept to production.",
  "Our capabilities span custom PCB design, PCB fabrication and printing, electronic circuit development, prototyping, embedded electronics and customised board solutions for industrial and commercial applications.",
  "We aim to transform ideas into reliable, practical and production-ready electronic products through engineering expertise, precision and quality-focused manufacturing.",
];

export const VISION =
  "To become a trusted electronics engineering and manufacturing company recognised for innovation, precision and quality, empowering businesses to transform ideas into advanced electronic products and technologies.";

export const MISSION = [
  "To deliver reliable, customised and cost-effective electronic solutions through innovative circuit design, PCB development, board manufacturing and printing, and continuous engineering improvement.",
  "We are committed to supporting startups, product developers, industries and businesses with dependable electronics solutions, from initial concept and prototyping to scalable production.",
];

export const PERSONALITY = ["Premium", "Innovative", "Precise", "Reliable", "Technology-driven"];

/** The seven core capabilities exactly as listed in the brand profile (PDF section 6). */
export const CORE_CAPABILITIES = [
  { name: "Electronic circuit design and development", detail: "Schematics, component selection and power budgets, engineered in-house." },
  { name: "PCB layout design and engineering", detail: "Layouts drawn for signal integrity, thermals and the factory floor." },
  { name: "PCB fabrication, manufacturing and printing", detail: "Boards made and printed to your specification." },
  { name: "Single, double and multilayer PCBs", detail: "From simple control boards to dense multilayer designs, subject to production capability." },
  { name: "Prototyping and customised boards", detail: "Working prototypes and one-off boards you can hold and test." },
  { name: "Embedded systems", detail: "Microcontroller-based electronics with the firmware that runs them." },
  { name: "Assembly, testing and product development", detail: "Finished, tested electronics, from first batch to scalable production." },
] as const;

/** The seven core capabilities from the brand profile, grouped for the site. */
export const CAPABILITY_GROUPS = [
  {
    group: "Design",
    summary: "Circuits and boards engineered on paper before a single copper layer is etched.",
    items: [
      { name: "Electronic circuit design", detail: "Schematics, component selection and power budgets for your product." },
      { name: "PCB layout engineering", detail: "Layouts drawn for signal integrity, thermals and the factory floor." },
      { name: "Embedded systems", detail: "Microcontroller-based electronics with the firmware that runs them." },
      { name: "Design for manufacture", detail: "Boards reviewed for yield and cost before the first production run." },
    ],
  },
  {
    group: "Build",
    summary: "Boards fabricated, printed and brought up in our workshop.",
    items: [
      { name: "PCB fabrication", detail: "Single-layer, double-layer and multilayer boards, subject to production capability." },
      { name: "PCB printing", detail: "Board printing and finishing to your specification." },
      { name: "Prototyping", detail: "Working prototypes you can hold, test and show to investors." },
      { name: "Customised boards", detail: "One-off and custom boards for industrial and commercial use." },
    ],
  },
  {
    group: "Deliver",
    summary: "Assembled, tested and ready to ship, from ten units to production volumes.",
    items: [
      { name: "Electronics assembly", detail: "Component placement and soldering of finished boards." },
      { name: "Testing", detail: "Functional and electrical testing against your acceptance criteria." },
      { name: "Product development support", detail: "Engineering help from first concept through each revision." },
      { name: "Scalable production", detail: "From pilot batches to repeat manufacturing runs." },
    ],
  },
] as const;

/** Sample journey for the "Bring your idea" itinerary. Durations are typical ranges for planning, not commitments. */
export const JOURNEY = [
  {
    phase: "Consult",
    steps: [
      { what: "Idea review and requirements", time: "Week 1" },
      { what: "Feasibility and component plan", time: "Week 1–2" },
    ],
  },
  {
    phase: "Design",
    steps: [
      { what: "Circuit design and schematic review", time: "Week 2–4" },
      { what: "PCB layout and design review", time: "Week 3–5" },
    ],
  },
  {
    phase: "Prototype",
    steps: [
      { what: "Board fabrication and assembly", time: "Week 5–7" },
      { what: "Bring-up, firmware and testing", time: "Week 6–8" },
    ],
  },
  {
    phase: "Manufacture",
    steps: [
      { what: "Pilot batch and sign-off", time: "Week 8–10" },
      { what: "Production runs and delivery", time: "Ongoing" },
    ],
  },
] as const;

export const FAQ = [
  {
    q: "I only have an idea. Can you still help?",
    a: "Yes. Most projects start as a sentence or a sketch. We turn it into requirements, a circuit, a board and then a product, and we tell you early what it will take.",
  },
  {
    q: "Will my idea stay confidential?",
    a: "We are happy to sign a mutual non-disclosure agreement before you share details. Tick the NDA box on the idea form and we will send one first.",
  },
  {
    q: "What kinds of boards can you make?",
    a: "Single-layer, double-layer and multilayer PCBs, subject to production capability, plus prototyping and customised boards for industrial and commercial use.",
  },
  {
    q: "Can you manufacture a design I already have?",
    a: "Yes. Send your schematics, Gerbers or bill of materials and we will review them for manufacture, then fabricate, assemble and test.",
  },
  {
    q: "Do you write firmware too?",
    a: "Yes. Embedded systems and microcontroller-based electronics are part of our core work, so the board and the code that runs it come from one team.",
  },
  {
    q: "How do I order from the product catalogue?",
    a: "Add items to your cart and send an order request. Prices include GST. We confirm stock, delivery and payment with you before anything ships.",
  },
] as const;
