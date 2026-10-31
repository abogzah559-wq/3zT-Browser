'use strict';
/*
 * "Same site" for passwords and the ad blocker, using the Public Suffix List (bundled tldts).
 * a.github.io and b.github.io are different sites (github.io is a public suffix);
 * www.bbc.co.uk and news.bbc.co.uk are the same site (bbc.co.uk).
 */
const { getDomain } = require('./vendor/tldts');

const cache = new Map();
function site(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!host) return '';
  let s = cache.get(host);
  if (s === undefined) {
    s = getDomain(host, { allowPrivateDomains: true }) || host;   // IP addresses, localhost: the host itself
    if (cache.size > 4000) cache.clear();
    cache.set(host, s);
  }
  return s;
}
module.exports = { site };
