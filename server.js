// server.js
// ATURAN EMAS ANTI-CHEAT: jangan pernah percaya angka yang dikirim browser
// kecuali itu sudah dicek ulang terhadap data di database (game.json).

const express = require('express');
const bcrypt = require('bcryptjs');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public')); // taruh vanoprojek.html di folder ./public agar bisa dibuka via http://localhost:3000/vanoprojek.html
app.use(cookieSession({
  name: 'session',
  keys: ['GANTI_INI_DENGAN_STRING_RAHASIA_ACAK'], // ganti sebelum dipakai serius
  maxAge: 24 * 60 * 60 * 1000
}));

// LADDER harus SAMA dengan yang ada di frontend, tapi yang MENENTUKAN
// adalah nilai di server ini. Frontend cuma boleh menampilkan.
const LADDER = [1, 1.5, 2.2, 3.5, 5.5, 9, 15, 26, 45];

// ---------- Anti-spam / anti-brute-force ----------
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Terlalu banyak percobaan, coba lagi nanti.' });
const gameLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'Terlalu cepat, pelan-pelan.' });

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Belum login' });
  next();
}

function getUser(id) {
  return db.get('users').find({ id }).value();
}

function saveUserBalance(id, newBalance) {
  db.get('users').find({ id }).assign({ balance: newBalance }).write();
}

function logTx(userId, type, amount, balanceAfter) {
  const id = db.get('nextTxId').value();
  db.get('transactions').push({
    id, user_id: userId, type, amount, balance_after: balanceAfter,
    created_at: new Date().toISOString()
  }).write();
  db.update('nextTxId', n => n + 1).write();
}

function getActiveRound(userId) {
  return db.get('active_rounds').find({ user_id: userId }).value();
}

// ---------- AUTH ----------
app.post('/api/register', authLimiter, (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: 'Username wajib, password minimal 6 karakter' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email tidak valid' });
  }
  const exists = db.get('users').find({ username }).value();
  if (exists) return res.status(400).json({ error: 'Username sudah dipakai' });
  const emailTaken = db.get('users').find({ email }).value();
  if (emailTaken) return res.status(400).json({ error: 'Email sudah terdaftar' });

  const hash = bcrypt.hashSync(password, 10);
  const id = db.get('nextUserId').value();
  db.get('users').push({
    id, username, email, password_hash: hash, balance: 1000,
    created_at: new Date().toISOString()
  }).write();
  db.update('nextUserId', n => n + 1).write();

  logTx(id, 'reset', 1000, 1000);
  req.session.userId = id;
  res.json({ ok: true, balance: 1000 });
});

app.post('/api/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = db.get('users').find({ username }).value();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }
  req.session.userId = user.id;
  res.json({ ok: true, balance: user.balance });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// ---------- SALDO (source of truth) ----------
app.get('/api/balance', requireLogin, (req, res) => {
  const user = getUser(req.session.userId);
  res.json({ balance: user.balance });
});

// ---------- SIAPA YANG SEDANG LOGIN ----------
app.get('/api/me', requireLogin, (req, res) => {
  const user = getUser(req.session.userId);
  res.json({ username: user.username, balance: user.balance });
});

// ---------- MULAI TARUHAN / FLIP ----------
app.post('/api/flip', requireLogin, gameLimiter, (req, res) => {
  const { sideChoice } = req.body; // 'depan' | 'belakang'
  if (sideChoice !== 'depan' && sideChoice !== 'belakang') {
    return res.status(400).json({ error: 'Pilihan sisi tidak valid' });
  }

  const userId = req.session.userId;
  const user = getUser(userId);
  let round = getActiveRound(userId);

  if (!round) {
    // Ronde baru: bet HARUS dikirim dan divalidasi terhadap saldo ASLI di DB,
    // bukan saldo yang (mungkin palsu) dikirim dari browser.
    const bet = parseInt(req.body.bet, 10);
    if (!Number.isInteger(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Taruhan tidak valid' });
    }
    if (bet > user.balance) {
      return res.status(400).json({ error: 'Saldo tidak cukup' });
    }

    const newBalance = user.balance - bet;
    saveUserBalance(userId, newBalance);
    db.get('active_rounds').push({
      user_id: userId, bet, step_index: 0, started_at: new Date().toISOString()
    }).write();
    logTx(userId, 'bet', -bet, newBalance);

    round = { user_id: userId, bet, step_index: 0 };
  }

  // RNG terjadi DI SERVER. Browser tidak punya kendali sedikit pun atas ini.
  const result = Math.random() < 0.5 ? 'depan' : 'belakang';
  const win = result === sideChoice;

  if (win) {
    const nextStep = round.step_index + 1;
    db.get('active_rounds').find({ user_id: userId }).assign({ step_index: nextStep }).write();
    const atMax = nextStep >= LADDER.length - 1;
    return res.json({
      result,
      win: true,
      stepIndex: nextStep,
      multiplier: LADDER[nextStep],
      atMax,
      potentialPayout: Math.round(round.bet * LADDER[nextStep])
    });
  } else {
    db.get('active_rounds').remove({ user_id: userId }).write();
    const freshUser = getUser(userId);
    logTx(userId, 'lose', 0, freshUser.balance); // saldo sudah dipotong saat bet dipasang
    return res.json({
      result,
      win: false,
      balance: freshUser.balance
    });
  }
});

// ---------- CASHOUT ----------
app.post('/api/cashout', requireLogin, gameLimiter, (req, res) => {
  const userId = req.session.userId;
  const round = getActiveRound(userId);
  if (!round || round.step_index === 0) {
    return res.status(400).json({ error: 'Tidak ada kemenangan untuk diambil' });
  }

  const user = getUser(userId);
  const payout = Math.round(round.bet * LADDER[round.step_index]);
  const newBalance = user.balance + payout;

  saveUserBalance(userId, newBalance);
  db.get('active_rounds').remove({ user_id: userId }).write();
  logTx(userId, 'cashout', payout, newBalance);

  res.json({ ok: true, balance: newBalance, payout });
});

// ---------- Endpoint contoh khusus admin (opsional) ----------
// Ini CONTOH aman: admin cuma bisa reset saldo akun MILIK SENDIRI,
// bukan mengatur menang/kalah user lain.
app.post('/api/reset-my-balance', requireLogin, (req, res) => {
  const userId = req.session.userId;
  saveUserBalance(userId, 1000);
  db.get('active_rounds').remove({ user_id: userId }).write();
  logTx(userId, 'reset', 0, 1000);
  res.json({ ok: true, balance: 1000 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
