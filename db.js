// db.js
// Pakai lowdb: database sederhana yang nyimpen semua data di file "game.json".
// Bedanya sama better-sqlite3: ini murni JavaScript, jadi nggak perlu
// kompilasi native code (nggak butuh Python/node-gyp) -> aman jalan di Termux.
//
// Konsep anti-cheat-nya SAMA seperti sebelumnya:
// semua "kebenaran" (saldo, status ronde) ada di file ini, server yang baca-tulis,
// browser cuma nampilin dan TIDAK PERNAH dipercaya langsung.

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('game.json');
const db = low(adapter);

// Struktur data awal kalau file game.json belum ada / masih kosong
db.defaults({
  users: [],          // { id, username, password_hash, balance, created_at }
  transactions: [],   // { id, user_id, type, amount, balance_after, created_at }
  active_rounds: [],  // { user_id, bet, step_index, started_at }
  nextUserId: 1,
  nextTxId: 1
}).write();

module.exports = db;
