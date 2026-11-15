'use strict';
/*
 * aria2 (https://aria2.github.io), the download engine behind big downloads: up to 16 connections per file,
 * retries, and continuing from where it stopped (also after a restart, from its .aria2 control file).
 * It runs as a hidden helper only while there is something to download, and listens on 127.0.0.1 only,
 * behind a random secret. It quits by itself if the browser goes away (--stop-with-process).
 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const net = require('net');
const fs = require('fs');

class Aria2 {
  constructor({ exe, log }) {
    this.exe = exe;
    this.log = log || (() => {});
    this.proc = null;
    this.ready = null;        // promise while starting
    this.port = 0;
    this.secret = '';
    this.seq = 0;
  }
  available() { try { return !!this.exe && fs.statSync(this.exe).isFile(); } catch (e) { return false; } }

  start() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.port = await freePort();
      this.secret = crypto.randomBytes(18).toString('hex');
      const args = [
        '--enable-rpc=true', '--rpc-listen-all=false', '--rpc-allow-origin-all=false',
        '--rpc-listen-port=' + this.port, '--rpc-secret=' + this.secret,
        '--stop-with-process=' + process.pid,
        '--max-concurrent-downloads=8', '--continue=true', '--file-allocation=none',
        '--check-certificate=true', '--summary-interval=0', '--console-log-level=error', '--quiet=true',
        '--disable-ipv6=false', '--remote-time=true', '--auto-save-interval=5'
      ];
      const p = spawn(this.exe, args, { windowsHide: true, stdio: 'ignore' });
      this.proc = p;
      p.on('exit', code => { this.log('aria2 exited', code); if (this.proc === p) { this.proc = null; this.ready = null; } });
      p.on('error', e => { this.log('aria2 failed to start', e.message); if (this.proc === p) { this.proc = null; this.ready = null; } });
      for (let i = 0; i < 50; i++) {      // up to 5 s for it to answer
        if (!this.proc) throw new Error('aria2 did not start');
        try { await this.call('getVersion'); return true; } catch (e) { await new Promise(r => setTimeout(r, 100)); }
      }
      this.stop();
      throw new Error('aria2 did not answer');
    })();
    this.ready.catch(() => { this.ready = null; });
    return this.ready;
  }
  stop() { const p = this.proc; this.proc = null; this.ready = null; if (p) { try { p.kill(); } catch (e) {} } }
  // the browser is closing: aria2 writes down what each download still needs (its .aria2 files) and exits,
  // so nothing is lost and an update can replace its file right after
  async shutdown(ms = 2500) {
    const p = this.proc; if (!p) return;
    const gone = new Promise(r => { if (p.exitCode !== null) r(); else p.once('exit', r); });
    try { await Promise.race([this.call('forceShutdown'), new Promise(r => setTimeout(r, 800))]); } catch (e) {}
    await Promise.race([gone, new Promise(r => setTimeout(r, ms))]);
    this.stop();
  }
  running() { return !!this.proc; }

  call(method, ...params) {
    const body = JSON.stringify({ jsonrpc: '2.0', id: String(++this.seq), method: 'aria2.' + method, params: ['token:' + this.secret, ...params] });
    return new Promise((resolve, reject) => {
      const q = http.request({ host: '127.0.0.1', port: this.port, path: '/jsonrpc', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 5000 }, r => {
        let d = ''; r.setEncoding('utf8'); r.on('data', c => (d += c));
        r.on('end', () => { try { const j = JSON.parse(d); if (j.error) reject(new Error(j.error.message || 'aria2 error')); else resolve(j.result); } catch (e) { reject(e); } });
      });
      q.on('timeout', () => q.destroy(new Error('aria2 timeout')));
      q.on('error', reject);
      q.end(body);
    });
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

module.exports = { Aria2 };
