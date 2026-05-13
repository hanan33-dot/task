const router = require('express').Router();
const db     = require('../database');

// GET /api/freelancers
router.get('/', (req, res) => {
  const { category, sub_category, min_price, max_price, min_exp, max_exp, limit = 100, offset = 0 } = req.query;

  let query = 'SELECT * FROM freelancers WHERE 1=1';
  const params = [];

  if (category)     { query += ' AND category = ?';     params.push(category); }
  if (sub_category) { query += ' AND sub_category = ?'; params.push(sub_category); }
  if (min_price)    { query += ' AND hourly_rate >= ?';    params.push(Number(min_price)); }
  if (max_price)    { query += ' AND hourly_rate <= ?';    params.push(Number(max_price)); }
  if (min_exp)      { query += ' AND experience_years >= ?'; params.push(Number(min_exp)); }
  if (max_exp)      { query += ' AND experience_years <= ?'; params.push(Number(max_exp)); }

  query += ' ORDER BY rating DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  res.json(db.prepare(query).all(...params));
});

// GET /api/freelancers/categories — list of distinct categories
router.get('/categories', (_, res) => {
  res.json(db.prepare("SELECT DISTINCT category FROM freelancers ORDER BY category").all().map(r => r.category));
});

module.exports = router;
