/*
 * Photo vault: encryption shared by the slideshow and the photo manager.
 *
 * Format (all files live in the slideshow folder; tools/encrypt_photos.py uses the same format):
 *   vault.json   {"v":1, "kdf":"PBKDF2-SHA256", "iter":600000, "salt":<base64 16 bytes>, "check":<base64 blob>}
 *   photos.enc   blob of JSON list: [{"f":"photos/<random>.enc", "t":"image/jpeg", "c":"caption"}, ...]
 *   photos/*.enc blob of the image bytes
 *   blob       = 12-byte random IV || AES-256-GCM ciphertext (16-byte tag at the end)
 *   key        = PBKDF2-HMAC-SHA256(passphrase NFC-normalized UTF-8, salt, iter) -> 32 bytes
 *   check      = blob of the UTF-8 text "slideshow-vault-v1" (used to detect a wrong passphrase)
 *
 * The key is stored on the device in IndexedDB as a non-extractable CryptoKey,
 * so the passphrase itself is never saved and the raw key can't be read back out.
 */
'use strict';
(function () {
  const te = new TextEncoder(), td = new TextDecoder();
  const CHECK = 'slideshow-vault-v1';
  const ITERATIONS = 600000;

  const b64enc = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const b64dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  function requireCrypto() {
    if (!(window.crypto && crypto.subtle)) throw new Error('Encryption needs a secure (https) page.');
  }

  async function deriveKey(pass, vault) {
    requireCrypto();
    const base = await crypto.subtle.importKey('raw', te.encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64dec(vault.salt), iterations: vault.iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encrypt(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv); out.set(ct, 12);
    return out;
  }

  async function decrypt(key, buf) {
    const u = new Uint8Array(buf);
    if (u.length < 28) throw new Error('Encrypted file is damaged');
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, key, u.subarray(12));
  }

  async function keyMatches(key, vault) {
    try { return td.decode(await decrypt(key, b64dec(vault.check))) === CHECK; } catch { return false; }
  }

  async function createVault(pass) {
    const vault = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS, salt: b64enc(crypto.getRandomValues(new Uint8Array(16))) };
    const key = await deriveKey(pass, vault);
    vault.check = b64enc(await encrypt(key, te.encode(CHECK)));
    return { vault, key };
  }

  async function unlock(pass, vault) {
    const key = await deriveKey(pass, vault);
    if (!(await keyMatches(key, vault))) throw new Error('Wrong passphrase');
    return key;
  }

  /* ----- Remembering the key on this device (IndexedDB) ----- */
  function openDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('slideshow-vault', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('keys');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function withStore(mode, fn) {
    const db = await openDb();
    return new Promise((res, rej) => {
      const t = db.transaction('keys', mode), req = fn(t.objectStore('keys'));
      t.oncomplete = () => { db.close(); res(req.result); };
      t.onerror = t.onabort = () => { db.close(); rej(t.error); };
    });
  }
  async function saveKey(key, vault) {
    try { await withStore('readwrite', s => s.put({ salt: vault.salt, key }, 'main')); return true; } catch { return false; }
  }
  async function loadKey(vault) {
    try {
      const v = await withStore('readonly', s => s.get('main'));
      if (v && v.salt === vault.salt && await keyMatches(v.key, vault)) return v.key;
    } catch { /* storage unavailable: ask for the passphrase */ }
    return null;
  }
  async function forgetKey() {
    try { await withStore('readwrite', s => s.delete('main')); } catch {}
  }

  /* ----- Files ----- */
  async function fetchBytes(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load ' + url + ' (' + r.status + ')');
    return r.arrayBuffer();
  }

  // Returns the vault description, or null when this site has no vault (unencrypted mode).
  async function loadVault() {
    let r;
    try { r = await fetch('vault.json', { cache: 'no-cache' }); }
    catch { return null; }   // offline and never seen a vault: treat as unencrypted
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Could not load vault.json (' + r.status + ')');
    const v = await r.json();
    if (v.v !== 1 || !v.salt || !v.check || !v.iter) throw new Error('vault.json is not a recognised format');
    return v;
  }

  async function loadList(key) {
    const r = await fetch('photos.enc', { cache: 'no-cache' });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('Could not load photos.enc (' + r.status + ')');
    const list = JSON.parse(td.decode(await decrypt(key, await r.arrayBuffer())));
    return Array.isArray(list) ? list.filter(p => p && p.f) : [];
  }

  const encryptList = (key, list) => encrypt(key, te.encode(JSON.stringify(list)));

  async function loadPhotoBlob(key, entry) {
    const plain = await decrypt(key, await fetchBytes(entry.f));
    return new Blob([plain], { type: entry.t || 'image/jpeg' });
  }

  function randomName() {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
  }

  window.Vault = {
    createVault, unlock, encrypt, decrypt, encryptList,
    saveKey, loadKey, forgetKey,
    loadVault, loadList, loadPhotoBlob, fetchBytes, randomName
  };
})();
