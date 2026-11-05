import express from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const uploadDir = path.join(root, 'uploads')
const dataFile = path.join(root, 'data', 'artworks.json')
const PASSWORD = process.env.ADMIN_PASSWORD
if (!PASSWORD) {
  console.error('Set the ADMIN_PASSWORD environment variable to enable uploads.')
  process.exit(1)
}

fs.mkdirSync(uploadDir, { recursive: true })
fs.mkdirSync(path.dirname(dataFile), { recursive: true })
const load = () => (fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : [])
const save = (items) => fs.writeFileSync(dataFile, JSON.stringify(items, null, 2))

const sessions = new Set()
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}
const bearer = (req) => (req.get('authorization') || '').replace(/^Bearer /, '')
const requireAuth = (req, res, next) => {
  const token = bearer(req)
  if (!sessions.has(token)) return res.status(401).json({ error: 'Not logged in' })
  next()
}

const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' }
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype in ALLOWED),
})

const app = express()
app.use(express.json())
app.use('/uploads', express.static(uploadDir))

app.get('/api/artworks', (req, res) => res.json(load()))

app.post('/api/login', (req, res) => {
  if (!safeEqual(req.body?.password ?? '', PASSWORD)) return res.status(401).json({ error: 'Wrong password' })
  const token = crypto.randomUUID()
  sessions.add(token)
  res.json({ token })
})

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(bearer(req))
  res.json({ ok: true })
})

app.post('/api/artworks', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A PNG, JPEG, GIF or WebP image is required' })
  const item = {
    id: crypto.randomUUID(),
    title: String(req.body.title || 'Untitled').slice(0, 100),
    description: String(req.body.description || '').slice(0, 500),
    file: req.file.filename,
    createdAt: new Date().toISOString(),
  }
  save([item, ...load()])
  res.status(201).json(item)
})

app.delete('/api/artworks/:id', requireAuth, (req, res) => {
  const items = load()
  const item = items.find((i) => i.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })
  save(items.filter((i) => i !== item))
  fs.rmSync(path.join(uploadDir, item.file), { force: true })
  res.json({ ok: true })
})

const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(process.env.PORT || 3001, () => console.log('Server running'))
