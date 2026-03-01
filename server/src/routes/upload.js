const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// POST /api/upload/signature — Cloudinary signed upload
router.post('/signature', authenticate, (req, res) => {
  if (process.env.UPLOAD_PROVIDER !== 'cloudinary') {
    return res.status(400).json({ error: { code: 'PROVIDER_ERROR', message: 'Cloudinary not configured' } });
  }
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `auction-items/${req.user.sub}`;
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  res.json({
    signature,
    timestamp,
    folder,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
  });
});

// POST /api/upload/local — local dev upload
if (process.env.UPLOAD_PROVIDER === 'local' || !process.env.UPLOAD_PROVIDER) {
  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
  const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

  router.post('/local', authenticate, upload.array('images', 10), (req, res) => {
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
  });
}

module.exports = router;
