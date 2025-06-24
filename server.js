const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const authMiddleware = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
// This lets our app understand JSON and serve our HTML/CSS/JS files
app.use(express.json());
app.use(express.static('public'));

// --- AUTHENTICATION ROUTES ---

// Route for registering a new user
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUserQuery = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id';
        const { rows } = await db.query(newUserQuery, [email, password_hash]);
        
        const payload = { user: { id: rows[0].id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.status(201).json({ token });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error or email already exists." });
    }
});

// Route for logging in a user
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userQuery = 'SELECT * FROM users WHERE email = $1';
        const { rows } = await db.query(userQuery, [email]);
        if (rows.length === 0) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        
        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error." });
    }
});


// --- PROTECTED API ROUTES ---

// GET all Trinity Dial entries for the logged-in user
app.get('/api/trinity', authMiddleware, async (req, res) => {
    try {
        const getEntriesQuery = 'SELECT * FROM trinity_entries WHERE user_id = $1 ORDER BY id DESC';
        const { rows } = await db.query(getEntriesQuery, [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST a new Trinity Dial entry
app.post('/api/trinity', authMiddleware, async (req, res) => {
    const { activity_name, focus_score, flow_score, fulfillment_score } = req.body;
    try {
        const addEntryQuery = 'INSERT INTO trinity_entries (user_id, activity_name, focus_score, flow_score, fulfillment_score) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        const { rows } = await db.query(addEntryQuery, [req.user.id, activity_name, focus_score, flow_score, fulfillment_score]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Neural Hub server started on port ${PORT}`);
    // Initialize the database in the background after starting
    db.initializeDB();
});