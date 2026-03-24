import express from "express";
import cors from "cors";
import dotenv from "dotenv";

console.log("Starting server.ts...");
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import bcryptjs from "bcryptjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Supabase Setup
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY");
    throw new Error("Configuration Supabase manquante");
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Hashed passwords (generated for 'password2026', 'Pharma2026', 'Docteur2026', 'Admin2026')
const HASHES = {
  SAISIE: "$2b$10$znds1yEmZsYFYMq0TqGIiuk9XQdykiorpdOQMyk7pZNpX12J4/5Xe", // password2026
  PARAMETRES: "$2b$10$znds1yEmZsYFYMq0TqGIiuk9XQdykiorpdOQMyk7pZNpX12J4/5Xe", // password2026
  DIRECTRICE: "$2b$10$NWam7wOfFFryihfgB3v.f.55Mn5RsyNp3ZEFzcG2Uy7edOu/.nb2a", // Pharma2026
  ASSISTANT: "$2b$10$FZczvPVWw.dXmh.MK6eNseAbFhLiA09zmxrScyeJh5ufxFoWVdX3a" // Docteur2026
};

// Password Verification Endpoints
app.post("/api/auth/verify", async (req, res) => {
  const { password, target } = req.body;
  if (!password) return res.status(400).json({ success: false, message: "Mot de passe requis" });

  const hash = target === 'saisie' ? HASHES.SAISIE : HASHES.PARAMETRES;
  const isMatch = await bcryptjs.compare(password, hash);
  
  if (isMatch) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Mot de passe incorrect" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { user, pass } = req.body;
    console.log(`Login attempt for user: ${user}`);
    
    if (!user || !pass) {
      return res.status(400).json({ success: false, message: "Identifiants requis" });
    }

    const normalizedUser = user.toLowerCase().trim();
    let hash = "";
    if (normalizedUser === 'directrice') hash = HASHES.DIRECTRICE;
    else if (normalizedUser === 'assistant') hash = HASHES.ASSISTANT;
    else {
      console.log(`Unknown user: ${normalizedUser}`);
      return res.status(401).json({ success: false, message: "Utilisateur inconnu" });
    }

    const isMatch = await bcryptjs.compare(pass, hash);
    console.log(`Password match for ${user}: ${isMatch}`);
    
    if (isMatch) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Mot de passe incorrect" });
    }
  } catch (error) {
    console.error("Server login error:", error);
    res.status(500).json({ success: false, message: "Erreur interne du serveur" });
  }
});

// API Routes for Transactions
app.get("/api/transactions", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("transactions").insert(req.body).select();
    if (error) return res.status(500).json(error);
    if (!data || data.length === 0) return res.status(500).json({ error: "Failed to create transaction" });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

app.patch("/api/transactions/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("transactions").update(req.body).eq("id", req.params.id).select();
    if (error) return res.status(500).json(error);
    if (!data || data.length === 0) return res.status(500).json({ error: "Failed to update transaction" });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("transactions").delete().eq("id", req.params.id);
    if (error) return res.status(500).json(error);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

// API Routes for Entities
app.get("/api/entities", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("entities").select("*");
    if (error) return res.status(500).json(error);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

app.post("/api/entities", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("entities").upsert(req.body).select();
    if (error) return res.status(500).json(error);
    if (!data || data.length === 0) return res.status(500).json({ error: "Failed to save entity" });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

// API Routes for Logs
app.get("/api/logs", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("audit_logs").select("*").order("timestamp", { ascending: false }).limit(100);
    if (error) return res.status(500).json(error);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

app.post("/api/logs", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("audit_logs").insert(req.body).select();
    if (error) return res.status(500).json(error);
    if (!data || data.length === 0) return res.status(500).json({ error: "Failed to add log" });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Supabase not configured" });
  }
});

async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer();
