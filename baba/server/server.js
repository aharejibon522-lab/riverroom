import express from "express";
import cors from "cors";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const DB = path.join(DATA_DIR, "jokes.json");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

async function load() {
  await mkdir(DATA_DIR, { recursive: true });
  try { return JSON.parse(await readFile(DB, "utf8")); }
  catch { const initial = { jokes: [], sets: [] }; await save(initial); return initial; }
}
async function save(data) { await mkdir(DATA_DIR, { recursive: true }); await writeFile(DB, JSON.stringify(data, null, 2)); }
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "BABA", version: "1.0.0" }));
app.get("/api/jokes", async (_req, res) => { const db = await load(); res.json(db.jokes.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))); });
app.post("/api/jokes", async (req, res) => {
  const { text, category = "Unsorted", language = "en", rating = 0, notes = "" } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: "Joke text is required." });
  const db = await load(), now = new Date().toISOString();
  const joke = { id: nanoid(), original: text.trim(), enhanced: "", category, language, rating, notes, createdAt: now, updatedAt: now };
  db.jokes.push(joke); await save(db); res.status(201).json(joke);
});
app.patch("/api/jokes/:id", async (req, res) => {
  const db = await load(), joke = db.jokes.find(x => x.id === req.params.id);
  if (!joke) return res.status(404).json({ error: "Joke not found." });
  Object.assign(joke, req.body, { id: joke.id, updatedAt: new Date().toISOString() }); await save(db); res.json(joke);
});
app.delete("/api/jokes/:id", async (req, res) => {
  const db = await load(), before = db.jokes.length; db.jokes = db.jokes.filter(x => x.id !== req.params.id);
  if (db.jokes.length === before) return res.status(404).json({ error: "Joke not found." });
  await save(db); res.status(204).end();
});
app.post("/api/sets", async (req, res) => {
  const { title = "My set", duration = 5, jokeIds = [] } = req.body || {};
  const db = await load(), set = { id: nanoid(), title, duration, jokeIds, createdAt: new Date().toISOString() };
  db.sets.push(set); await save(db); res.status(201).json(set);
});
app.get("/api/sets", async (_req, res) => { const db = await load(); res.json(db.sets); });
app.post("/api/comedy/polish", (req, res) => {
  const { text, language = "en" } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: "Add a joke first." });
  const clean = text.trim().replace(/[. ]+$/, "");
  const bangla = language === "bn";
  res.json({
    original: text,
    suggestions: bangla
      ? [clean + " — আর এখানেই আসল মজাটা!", "একটু বিরতি দিন… তারপর শেষ লাইনটা বলুন: " + clean]
      : [clean + "… and that's where it gets ridiculous.", "Pause before the last line, then try: " + clean],
    note: bangla ? "এগুলো প্রস্তাবনা—আপনার আসল লেখাটি অপরিবর্তিত থাকবে।" : "Suggestions only. Your original joke is never changed."
  });
});
app.listen(PORT, () => console.log(`BABA API listening on ${PORT}`));
