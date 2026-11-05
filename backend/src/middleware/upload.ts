import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.ts";

/** Uploaded product photos are served from here (see app.ts). */
export const UPLOAD_PREFIX = "/api/uploads/products/";
const productDir = () => path.join(config.uploadDir, "products");

const ALLOWED: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(productDir(), { recursive: true });
      cb(null, productDir());
    } catch (e) {
      cb(e as Error, "");
    }
  },
  // The stored name never uses the client's file name; the extension comes from the checked MIME type.
  filename: (_req, file, cb) => cb(null, `product-${Date.now()}-${randomBytes(6).toString("hex")}${ALLOWED[file.mimetype]}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = Boolean(ALLOWED[file.mimetype]) && /^\.(jpe?g|png|webp)$/.test(ext);
    if (ok) cb(null, true);
    else cb(new Error("Only JPG, PNG or WEBP images are allowed"));
  },
});

/** Signatures of the allowed formats, checked after upload so a renamed file cannot pass as an image. */
function looksLikeImage(file: string) {
  const fd = fs.openSync(file, "r");
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  return jpg || png || webp;
}

export function imageUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (err: unknown) => {
    if (err) {
      const e = err as { code?: string; message?: string };
      res.status(400).json({ message: e.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : e.message ?? "Upload failed" });
      return;
    }
    if (req.file && !looksLikeImage(req.file.path)) {
      fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ message: "That file is not a valid JPG, PNG or WEBP image." });
      return;
    }
    next();
  });
}

export function removeUploadedImage(imageUrl: string | null | undefined) {
  if (!imageUrl || !imageUrl.startsWith(UPLOAD_PREFIX)) return;
  const file = path.join(productDir(), path.basename(imageUrl));
  try {
    fs.rmSync(file, { force: true });
  } catch (e) {
    console.error("Could not remove product image", e);
  }
}
