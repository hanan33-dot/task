const router = require('express').Router();
const db     = require('../database');
const { requireAuth } = require('../middleware/auth');

// GET /api/posts — list all posts (public)
router.get('/', (req, res) => {
  const { category, status = 'open', limit = 20, offset = 0 } = req.query;

  let query = `
    SELECT p.*, u.name AS author_name, u.role AS author_role,
           (SELECT COUNT(*) FROM proposals WHERE post_id = p.id) AS proposals_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE 1=1
  `;
  const params = [];

  // status='all' skips the filter; otherwise filter by status
  if (status !== 'all') { query += ' AND p.status = ?'; params.push(status); }

  if (category) { query += ' AND p.category = ?'; params.push(category); }
  if (req.query.user_id) { query += ' AND p.user_id = ?'; params.push(Number(req.query.user_id)); }
  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  res.json(db.prepare(query).all(...params));
});

// GET /api/posts/:id — single post with proposals count
router.get('/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.name AS author_name, u.role AS author_role,
           (SELECT COUNT(*) FROM proposals WHERE post_id = p.id) AS proposals_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// POST /api/posts — create post (clients only)
router.post('/', requireAuth, (req, res) => {
  if (req.user.role !== 'client')
    return res.status(403).json({ error: 'Only clients can post jobs' });

  const { title, description, budget, category } = req.body;
  if (!title || !description)
    return res.status(400).json({ error: 'Title and description are required' });

  const result = db.prepare(
    'INSERT INTO posts (title, description, budget, category, user_id) VALUES (?, ?, ?, ?, ?)'
  ).run(title, description, budget || 0, category || 'General', req.user.id);

  res.status(201).json({ message: 'Post created', id: result.lastInsertRowid });
});

// PUT /api/posts/:id — update post (owner only)
router.put('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

  const { title, description, budget, category, status } = req.body;
  db.prepare(`
    UPDATE posts SET
      title       = COALESCE(?, title),
      description = COALESCE(?, description),
      budget      = COALESCE(?, budget),
      category    = COALESCE(?, category),
      status      = COALESCE(?, status)
    WHERE id = ?
  `).run(title, description, budget, category, status, req.params.id);

  res.json({ message: 'Post updated' });
});

// DELETE /api/posts/:id — delete post (owner only)
router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

  db.prepare('DELETE FROM proposals WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Post deleted' });
});

// POST /api/posts/:id/proposals — freelancer submits proposal
router.post('/:id/proposals', requireAuth, (req, res) => {
  if (req.user.role !== 'freelancer')
    return res.status(403).json({ error: 'Only freelancers can submit proposals' });

  const post = db.prepare("SELECT * FROM posts WHERE id = ? AND status = 'open'").get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found or closed' });

  const { message, price } = req.body;
  if (!message || !price)
    return res.status(400).json({ error: 'Message and price are required' });

  const already = db.prepare('SELECT id FROM proposals WHERE post_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (already) return res.status(409).json({ error: 'You already submitted a proposal' });

  const result = db.prepare(
    'INSERT INTO proposals (post_id, user_id, message, price) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, req.user.id, message, price);

  res.status(201).json({ message: 'Proposal submitted', id: result.lastInsertRowid });
});

// GET /api/posts/:id/proposals — get proposals (post owner only)
router.get('/:id/proposals', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

  const proposals = db.prepare(`
    SELECT pr.*, u.name AS freelancer_name, u.bio AS freelancer_bio
    FROM proposals pr
    JOIN users u ON u.id = pr.user_id
    WHERE pr.post_id = ?
    ORDER BY pr.created_at DESC
  `).all(req.params.id);

  res.json(proposals);
});

module.exports = router;
