import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN, adminAgent, app, prisma, request, resetDb } from "./helpers.ts";
import { upsertAdmin } from "../services/auth.ts";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("admin auth", () => {
  it("admin routes refuse anonymous requests", async () => {
    expect((await request(app).get("/api/products/admin/all")).status).toBe(401);
    expect((await request(app).post("/api/products").send({ name: "x", sku: "x", price: 1 })).status).toBe(401);
    expect((await request(app).get("/api/admin/ideas")).status).toBe(401);
    expect((await request(app).get("/api/admin/summary")).status).toBe(401);
  });

  it("a forged or tampered cookie is rejected", async () => {
    const res = await request(app).get("/api/admin/me").set("Cookie", "vx_admin=eyJhbGciOiJIUzI1NiJ9.e30.bad");
    expect(res.status).toBe(401);
  });

  it("wrong credentials fail with one generic message; right ones set an httpOnly cookie", async () => {
    await upsertAdmin(ADMIN.email, ADMIN.password);
    const wrongPw = await request(app).post("/api/admin/login").send({ email: ADMIN.email, password: "nope" });
    const wrongUser = await request(app).post("/api/admin/login").send({ email: "who@test.local", password: "nope" });
    expect(wrongPw.status).toBe(401);
    expect(wrongUser.body.message).toBe(wrongPw.body.message);
    const ok = await request(app).post("/api/admin/login").send(ADMIN);
    expect(ok.status).toBe(200);
    expect(String(ok.headers["set-cookie"])).toMatch(/vx_admin=.+HttpOnly/i);
  });

  it("state-changing admin calls from a foreign origin are refused", async () => {
    const agent = await adminAgent();
    const res = await agent.post("/api/products").set("Origin", "https://evil.example").send({ name: "x", sku: "x", price: 1 });
    expect(res.status).toBe(403);
  });

  it("logout clears the session cookie", async () => {
    const agent = await adminAgent();
    await agent.post("/api/admin/logout");
    expect((await agent.get("/api/admin/me")).status).toBe(401);
  });
});

describe("ideas and contact inboxes", () => {
  const idea = {
    name: "Ravi Kumar",
    email: "ravi@example.invalid",
    stage: "Sketch or concept",
    services: ["Circuit design", "PCB layout"],
    description: "A battery-powered soil moisture sensor that reports over LoRa every hour.",
  };

  it("validates and stores an idea, which the admin can read and archive", async () => {
    expect((await request(app).post("/api/ideas").send({ ...idea, description: "short" })).status).toBe(400);
    expect((await request(app).post("/api/ideas").send({ ...idea, stage: "Whatever" })).status).toBe(400);
    expect((await request(app).post("/api/ideas").send({ ...idea, website: "http://spam" })).status).toBe(400);
    const created = await request(app).post("/api/ideas").send({ ...idea, phone: "98450 00000" });
    expect(created.status).toBe(201);

    const agent = await adminAgent();
    const list = await agent.get("/api/admin/ideas");
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ phone: "+91 9845000000", status: "new", services: ["Circuit design", "PCB layout"] });
    expect((await agent.get("/api/admin/summary")).body.newIdeas).toBe(1);
    await agent.patch(`/api/admin/ideas/${created.body.id}`).send({ status: "archived" });
    expect((await agent.get("/api/admin/ideas")).body.data).toHaveLength(0);
    expect((await agent.get("/api/admin/ideas?status=archived")).body.data).toHaveLength(1);
  });

  it("stores contact messages", async () => {
    expect((await request(app).post("/api/contact").send({ name: "A", email: "bad", message: "hello there team" })).status).toBe(400);
    const ok = await request(app).post("/api/contact").send({ name: "A", email: "a@example.invalid", message: "Need 500 boards quoted." });
    expect(ok.status).toBe(201);
    const agent = await adminAgent();
    expect((await agent.get("/api/admin/messages")).body.data).toHaveLength(1);
  });

  it("health check reports the database", async () => {
    expect((await request(app).get("/api/health")).body).toEqual({ status: "ok" });
  });
});
