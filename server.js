require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Add your PostgreSQL connection string to .env or your hosting provider.');
}

if (!process.env.HF_API_KEY) {
  throw new Error('HF_API_KEY is required for the AI routes. Add it to .env or your hosting provider.');
}

// 🟢 HYBRID FIX 1: Universal SSL detection
// Enables SSL whenever connecting to Render's cloud PostgreSQL, locally or in production.
const isRenderCloudDb = process.env.DATABASE_URL.includes('render.com') || process.env.DATABASE_URL.includes('dpg-');
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRenderCloudDb || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      project_title TEXT DEFAULT '',
      project_abstract TEXT DEFAULT '',
      project_description TEXT DEFAULT '',
      project_lit_survey TEXT DEFAULT '',
      project_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Connected to PostgreSQL database');
}

function parseModules(value) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || '[]');
  } catch (error) {
    return [];
  }
}

const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';

async function generateWithHuggingFace(prompt) {
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Hugging Face request failed (${response.status}): ${details.slice(0, 300)}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('Hugging Face returned an empty response.');
  return text.trim();
}

function parseJsonArray(text) {
  const unfencedText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = unfencedText.indexOf('[');
  const end = unfencedText.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error('Hugging Face did not return a JSON array.');
  return JSON.parse(unfencedText.slice(start, end + 1));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- AUTHENTICATION & FETCH ROUTES ---

// 1. REGISTER: Create record
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();
    await db.query(
      'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
      [userId, name.trim(), cleanEmail, hashedPassword]
    );

    console.log(`👤 User registered in PostgreSQL: ${cleanEmail}`);
    return res.status(201).json({
      message: 'Registration successful!',
      user: { id: userId, name: name.trim(), email: cleanEmail }
    });
  } catch (err) {
    console.error('Registration database error:', err.message);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
});

// 2. LOGIN: Verify credentials and fetch existing project data
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

    console.log(`🔑 User authenticated & fetched: ${cleanEmail}`);
    return res.status(200).json({
      message: 'Login successful!',
      name: user.name,
      email: user.email,
      project: {
        title: user.project_title,
        abstract: user.project_abstract,
        description: user.project_description,
        litSurvey: user.project_lit_survey,
        modules: parseModules(user.project_modules)
      }
    });
  } catch (err) {
    console.error('Login database error:', err.message);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

// 3. FETCH PROJECT: Retrieve whenever needed
app.get('/api/project/load', async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email parameter required.' });

  try {
    const result = await db.query(
      'SELECT name, email, project_title, project_abstract, project_description, project_lit_survey, project_modules FROM users WHERE email = $1',
      [email]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'No user profile found.' });

    return res.json({
      name: row.name,
      email: row.email,
      project: {
        title: row.project_title,
        abstract: row.project_abstract,
        description: row.project_description,
        litSurvey: row.project_lit_survey,
        modules: parseModules(row.project_modules)
      }
    });
  } catch (err) {
    console.error('Project load database error:', err.message);
    return res.status(500).json({ error: 'Database read failure.' });
  }
});

// 4. SAVE PROJECT: Update database with current work
app.post('/api/project/save', async (req, res) => {
  const { email, title, abstract, description, litSurvey, modules } = req.body;
  if (!email) return res.status(400).json({ error: 'User email required.' });

  const cleanEmail = email.toLowerCase().trim();
  const query = `
    UPDATE users 
    SET project_title = $1,
        project_abstract = $2,
        project_description = $3,
        project_lit_survey = $4,
        project_modules = $5::jsonb,
        updated_at = CURRENT_TIMESTAMP
    WHERE email = $6
  `;

  try {
    await db.query(query, [
      title || '',
      abstract || '',
      description || '',
      litSurvey || '',
      JSON.stringify(modules || []),
      cleanEmail
    ]);
    console.log(`💾 Synced project progress to PostgreSQL for: ${cleanEmail}`);
    return res.json({ message: 'Project progress saved successfully to PostgreSQL!' });
  } catch (err) {
    console.error('Project save database error:', err.message);
    return res.status(500).json({ error: 'Failed to update database.' });
  }
});

// --- HUGGING FACE AI ASSISTANT ROUTES ---

app.post('/api/ai/polish-abstract', async (req, res) => {
  const { title, rawAbstract } = req.body;
  try {
    const prompt = `You are an academic reviewer for undergraduate computer applications projects. 
Polish this synopsis abstract into a concise, professional, formal academic abstract (around 80-120 words):
Project Title: "${title || 'Computer Applications Project'}"
Draft: "${rawAbstract || 'Build a scalable software solution'}"

Output ONLY the polished paragraph without quotes or conversational prefixes.`;

    const polishedAbstract = await generateWithHuggingFace(prompt);
    res.json({ polishedAbstract });
  } catch (err) {
    console.error('Hugging Face polish error:', err.message);
    res.status(500).json({ error: 'Hugging Face service error.' });
  }
});

app.post('/api/ai/suggest-modules', async (req, res) => {
  const { title, description } = req.body;
  try {
    const prompt = `You are a software engineering lead.
For a project titled "${title || 'Software System'}" with description "${description || 'Application system'}", suggest 3 functional modules.
Respond STRICTLY with a valid JSON array of objects with "title" and "desc" properties.`;

    const generatedText = await generateWithHuggingFace(prompt);
    res.json({ modules: parseJsonArray(generatedText) });
  } catch (err) {
    console.error('Hugging Face module suggestion error:', err.message);
    res.status(500).json({ error: 'Failed to get module suggestions from Hugging Face.' });
  }
});

// 🟢 HYBRID FIX 2: Listen on 0.0.0.0
initializeDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ PostgreSQL initialization failed:', error.message);
    process.exit(1);
  });