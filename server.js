const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const authMiddleware = require('./authMiddleware');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static('public'));
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, 10);
        const { rows } = await db.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', [email, password_hash]);
        const payload = { user: { id: rows[0].id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => { if (err) throw err; res.json({ token }); });
    } catch (err) { res.status(500).json({ error: "Server error or email already exists." }); }
});
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length === 0) return res.status(400).json({ msg: 'Invalid Credentials' });
        const isMatch = await bcrypt.compare(password, rows[0].password_hash);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });
        const payload = { user: { id: rows[0].id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => { if (err) throw err; res.json({ token }); });
    } catch (err) { res.status(500).json({ error: "Server error." }); }
});
// --- PROTECTED API ROUTES ---

// Get all Trinity Dial entries for the logged-in user
app.get('/api/trinity', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM trinity_entries WHERE user_id = $1 ORDER BY entry_date DESC, created_at DESC', 
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Add a new Trinity Dial entry
app.post('/api/trinity', authMiddleware, async (req, res) => {
    const { activity_name, focus_score, flow_score, fulfillment_score } = req.body;
    try {
        const { rows } = await db.query(
            'INSERT INTO trinity_entries (user_id, activity_name, focus_score, flow_score, fulfillment_score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.user.id, activity_name, focus_score, flow_score, fulfillment_score]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});
app.post('/api/trinity', authMiddleware, async (req, res) => {
    const { activity_name, focus_score, flow_score, fulfillment_score } = req.body;
    const { rows } = await db.query('INSERT INTO trinity_entries (user_id, activity_name, focus_score, flow_score, fulfillment_score) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.user.id, activity_name, focus_score, flow_score, fulfillment_score]);
    res.json(rows[0]);
});
db.initializeDB()// Start the server FIRST, then initialize the DB in the background
app.listen(PORT, () => {
    console.log(`Neural Hub server running on port ${PORT}`);
    // Now, initialize the database after the server is already live
    db.initializeDB();
});