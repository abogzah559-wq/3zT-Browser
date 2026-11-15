#!/usr/bin/env node
// A small stand-in for aria2c, for the end-to-end tests on machines without it (the Windows build ships the
// real one). It speaks the same JSON-RPC subset src/downloads.js uses: getVersion, addUri, tellStatus,
// forcePause, unpause, forceRemove, removeDownloadResult. One connection per file, continues with Range.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const arg = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');
const port = +arg('rpc-listen-port'), secret = arg('rpc-secret'), parent = +arg('stop-with-process');
if (parent) setInterval(() => { try { process.kill(parent, 0); } catch (e) { process.exit(0); } }, 1000);
const jobs = new Map();
let seq = 0;

function run(j) {
  const file = path.join(j.opt.dir, j.opt.out);
  let from = 0;
  if (j.opt.continue === 'true' || j.started) { try { from = fs.statSync(file).size; } catch (e) {} }
  else { try { fs.unlinkSync(file); } catch (e) {} }
  j.started = true;
  const headers = { 'User-Agent': j.opt['user-agent'] || 'aria2/1.37.0' };
  for (const h of j.opt.header || []) { const i = h.indexOf(':'); headers[h.slice(0, i).trim()] = h.slice(i + 1).trim(); }
  if (from) headers.Range = `bytes=${from}-`;
  const get = (u, hops) => {
    const q = (u.startsWith('https') ? https : http).get(u, { headers }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hops < 5) { r.resume(); return get(new URL(r.headers.location, u).href, hops + 1); }
      if (r.statusCode !== 200 && r.statusCode !== 206) { j.status = 'error'; j.err = 'HTTP ' + r.statusCode; r.resume(); return; }
      if (r.statusCode === 200) from = 0;
      const len = +r.headers['content-length'] || 0;
      j.total = r.statusCode === 206 ? from + len : len;
      j.done = from;
      fs.writeFileSync(file + '.aria2', 'mock');
      const out = fs.createWriteStream(file, { flags: from ? 'r+' : 'w', start: from });
      let t = Date.now(), b = from;
      r.on('data', d => { j.done += d.length; const now = Date.now(); if (now - t > 500) { j.speed = Math.round((j.done - b) / ((now - t) / 1000)); t = now; b = j.done; } });
      r.pipe(out);
      out.on('finish', () => { if (j.status === 'active') { if (j.total && j.done < j.total) { j.status = 'error'; j.err = 'connection closed'; } else { j.status = 'complete'; try { fs.unlinkSync(file + '.aria2'); } catch (e) {} } } });
      r.on('aborted', () => { if (j.status === 'active') { j.status = 'error'; j.err = 'aborted'; } });
    });
    q.on('error', e => { if (j.status === 'active') { j.status = 'error'; j.err = e.message; } });
    j.req = q;
  };
  j.status = 'active'; j.speed = 0;
  get(j.uri, 0);
}

const methods = {
  getVersion: () => ({ version: '1.37.0-mock' }),
  addUri: ([uri], opt) => { const gid = (++seq).toString(16).padStart(16, '0'); const j = { gid, uri, opt, status: 'waiting', total: 0, done: 0, speed: 0 }; jobs.set(gid, j); run(j); return gid; },
  tellStatus: gid => { const j = jobs.get(gid); if (!j) throw new Error('GID not found'); return { gid, status: j.status, totalLength: String(j.total), completedLength: String(j.done), downloadSpeed: String(j.status === 'active' ? j.speed : 0), errorMessage: j.err || '' }; },
  forcePause: gid => { const j = jobs.get(gid); if (j && j.status === 'active') { j.status = 'paused'; j.req && j.req.destroy(); } return gid; },
  unpause: gid => { const j = jobs.get(gid); if (j && j.status === 'paused') run(j); return gid; },
  forceRemove: gid => { const j = jobs.get(gid); if (j) { j.status = 'removed'; j.req && j.req.destroy(); } return gid; },
  removeDownloadResult: gid => { jobs.delete(gid); return 'OK'; },
  forceShutdown: () => { setTimeout(() => process.exit(0), 50); return 'OK'; }
};

http.createServer((q, r) => {
  let body = ''; q.on('data', d => (body += d)); q.on('end', () => {
    let m; try { m = JSON.parse(body); } catch (e) { r.writeHead(400); return r.end(); }
    const [tok, ...params] = m.params || [];
    const reply = o => { r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, ...o })); };
    if (tok !== 'token:' + secret) return reply({ error: { code: 1, message: 'Unauthorized' } });
    const f = methods[String(m.method).replace(/^aria2\./, '')];
    if (!f) return reply({ error: { code: 1, message: 'no method' } });
    try { reply({ result: f(...params) }); } catch (e) { reply({ error: { code: 1, message: e.message } }); }
  });
}).listen(port, '127.0.0.1');
