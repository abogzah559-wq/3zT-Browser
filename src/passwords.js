'use strict';
/*
 * Password store.
 * Passwords are encrypted with Electron safeStorage: on Windows that is DPAPI, tied to the
 * user's Windows account (the same protection Chrome uses). The file never holds plain text
 * unless the OS offers no encryption at all (then they are only obfuscated, and the UI says so).
 */
const fs = require('fs');
const crypto = require('crypto');

const originOf = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.origin : ''; } catch (e) { return ''; } };
const hostOf = o => { try { return new URL(o).hostname.toLowerCase(); } catch (e) { return ''; } };
// same site = same registrable domain on the Public Suffix List, so a.github.io never sees b.github.io's passwords
const { site } = require('./domains');

/* RFC 4180 CSV (quotes, commas and new lines inside quotes) */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

class PasswordStore {
  constructor(file, safeStorage) {
    this.file = file; this.ss = safeStorage;
    this.data = { entries: [] };
    try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(this.data.entries)) this.data.entries = []; } catch (e) {}
    this.t = null;
    // entries an older version kept unencrypted: encrypt them now
    try {
      if (this.encrypted) {
        let n = 0;
        for (const e of this.data.entries) if (typeof e.password === 'string' && e.password.startsWith('b64:')) { const p = this.dec(e.password); if (p) { e.password = this.enc(p); n++; } }
        if (n) this.flush();
      }
    } catch (e) {}
  }
  get encrypted() { try { return this.ss.isEncryptionAvailable(); } catch (e) { return false; } }
  enc(s) {
    // only ever stored encrypted (Windows DPAPI); without encryption nothing is saved
    if (this.encrypted) return 'dpapi:' + this.ss.encryptString(s).toString('base64');
    return null;
  }
  dec(s) {
    try {
      if (s.startsWith('dpapi:')) return this.ss.decryptString(Buffer.from(s.slice(6), 'base64'));
      if (s.startsWith('b64:')) return Buffer.from(s.slice(4), 'base64').toString('utf8');
    } catch (e) {}
    return '';
  }
  save() {
    clearTimeout(this.t);
    this.t = setTimeout(() => this.flush(), 300);
  }
  flush() {
    clearTimeout(this.t);
    try { fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data)); fs.renameSync(this.file + '.tmp', this.file); } catch (e) {}
  }

  find(origin, username) { return this.data.entries.find(e => e.origin === origin && e.username === username); }
  upsert(url, username, password, opts = {}) {
    const origin = originOf(url); if (!origin || !password) return null;
    const sealed = this.enc(password); if (!sealed) return null;   // encryption not available: refuse
    let e = this.find(origin, username || '');
    if (e) {
      if (this.dec(e.password) === password) return { entry: e, changed: false };
      e.password = sealed; e.updated = Date.now();
    } else {
      e = { id: crypto.randomUUID(), origin, url: opts.keepUrl ? url : origin, username: username || '', password: sealed, created: Date.now(), used: 0, note: opts.note || '' };
      this.data.entries.push(e);
    }
    this.save();
    return { entry: e, changed: true };
  }
  remove(id) { const n = this.data.entries.length; this.data.entries = this.data.entries.filter(e => e.id !== id); this.save(); return n !== this.data.entries.length; }
  get(id) { return this.data.entries.find(e => e.id === id) || null; }
  reveal(id) { const e = this.get(id); return e ? this.dec(e.password) : ''; }

  /* accounts for a page: same origin first, then the same site (e.g. accounts.example.com on example.com) */
  forOrigin(origin) {
    const host = hostOf(origin), s = site(host);
    const exact = [], related = [];
    for (const e of this.data.entries) {
      if (e.origin === origin) exact.push(e);
      else if (origin.startsWith('https:') && e.origin.startsWith('https:') && site(hostOf(e.origin)) === s) related.push(e);
    }
    const sort = a => a.sort((x, y) => (y.used || 0) - (x.used || 0));
    return [...sort(exact), ...sort(related)];
  }
  touch(id) { const e = this.get(id); if (e) { e.used = Date.now(); this.save(); } }

  /* Chrome / Edge / Firefox export: name,url,username,password,note (column order may differ) */
  importCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) return { added: 0, updated: 0, skipped: 0 };
    const head = rows[0].map(h => h.trim().toLowerCase());
    const col = n => head.findIndex(h => n.includes(h));
    const iu = col(['url', 'website', 'origin', 'login_uri']), iun = col(['username', 'login', 'user', 'login_username']),
      ip = col(['password', 'login_password']), inote = col(['note', 'notes']);
    if (iu < 0 || ip < 0) throw new Error('not a passwords CSV');
    let added = 0, updated = 0, skipped = 0;
    for (const r of rows.slice(1)) {
      const url = (r[iu] || '').trim(), pw = r[ip] || '', un = iun >= 0 ? (r[iun] || '') : '';
      if (!originOf(url) || !pw) { skipped++; continue; }
      const before = this.find(originOf(url), un);
      const res = this.upsert(url, un, pw, { note: inote >= 0 ? r[inote] || '' : '' });
      if (!res) skipped++; else if (!before) added++; else if (res.changed) updated++;
    }
    this.flush();
    return { added, updated, skipped };
  }
  list() {
    return this.data.entries.map(e => ({ id: e.id, origin: e.origin, host: hostOf(e.origin), username: e.username, created: e.created, used: e.used || 0 }))
      .sort((a, b) => a.host.localeCompare(b.host) || a.username.localeCompare(b.username));
  }
}

module.exports = { PasswordStore, parseCSV, originOf, site };
