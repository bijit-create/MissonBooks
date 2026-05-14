import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import validateNcert from "./api/validate-ncert.js";
import generateQuestions from "./api/generate-questions.js";
import generateSolvedExample from "./api/generate-solved-example.js";
import generateImage from "./api/generate-image.js";
import editImage from "./api/edit-image.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  app.post("/api/validate-ncert", (req, res) => validateNcert(req, res));
  app.post("/api/generate-questions", (req, res) => generateQuestions(req, res));
  app.post("/api/generate-solved-example", (req, res) => generateSolvedExample(req, res));
  app.post("/api/generate-image", (req, res) => generateImage(req, res));
  app.post("/api/edit-image", (req, res) => editImage(req, res));

  if (process.env.NODE_ENV !== "production") {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
