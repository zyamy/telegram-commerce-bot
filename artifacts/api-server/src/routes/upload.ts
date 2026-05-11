import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `qr-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya fail gambar dibenarkan"));
    }
  },
});

router.post("/upload", upload.single("file"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "Tiada fail dimuat naik" });
    return;
  }
  const relativePath = `/api/uploads/${req.file.filename}`;
  const domain =
    process.env.REPLIT_DOMAINS?.split(",")[0] ||
    process.env.PUBLIC_DOMAIN ||
    req.get("host") ||
    "";
  const fileUrl = domain
    ? `https://${domain}${relativePath}`
    : relativePath;
  res.json({ url: fileUrl });
});

export default router;
