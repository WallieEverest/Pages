#!/usr/bin/env python3
"""
Manage the slideshow's encrypted photos from a local clone of the repo.
Same format as slideshow/vault.js, so the browser photo manager and this script are interchangeable.

Setup:  pip install cryptography pillow        (pillow-heif too, if you want to add .HEIC files)

Usage (run from the repo root, then git add/commit/push):
  python3 tools/encrypt_photos.py add  PHOTO [PHOTO ...] [--no-resize] [--caption TEXT]
  python3 tools/encrypt_photos.py list
  python3 tools/encrypt_photos.py caption NUMBER "New caption"
  python3 tools/encrypt_photos.py remove NUMBER [NUMBER ...]
  python3 tools/encrypt_photos.py export FOLDER        (decrypt everything, e.g. for a backup)

The passphrase is asked for interactively, or read from the SLIDESHOW_PASS environment variable.
The first 'add' creates the vault (vault.json) if there isn't one yet.
Use --dir to point at the slideshow folder if it isn't ./slideshow.
"""
import argparse, base64, getpass, hashlib, io, json, os, re, secrets, sys, unicodedata

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.exceptions import InvalidTag
except ImportError:
    sys.exit("This script needs the 'cryptography' package:  pip install cryptography")

CHECK = b"slideshow-vault-v1"
ITERATIONS = 600_000


# ---------- crypto (must match vault.js) ----------
def derive_key(passphrase, vault):
    pw = unicodedata.normalize("NFC", passphrase).encode()
    return hashlib.pbkdf2_hmac("sha256", pw, base64.b64decode(vault["salt"]), vault["iter"], 32)

def seal(key, data):
    iv = secrets.token_bytes(12)
    return iv + AESGCM(key).encrypt(iv, data, None)

def open_blob(key, blob):
    return AESGCM(key).decrypt(blob[:12], blob[12:], None)


# ---------- vault files ----------
class Vault:
    def __init__(self, folder):
        self.dir = folder
        self.vault_path = os.path.join(folder, "vault.json")
        self.list_path = os.path.join(folder, "photos.enc")
        self.vault = self.key = None
        self.items = []

    def exists(self):
        return os.path.exists(self.vault_path)

    def unlock(self, create=False):
        env = os.environ.get("SLIDESHOW_PASS")
        if self.exists():
            self.vault = json.load(open(self.vault_path))
            pw = env if env is not None else getpass.getpass("Passphrase: ")
            self.key = derive_key(pw, self.vault)
            try:
                ok = open_blob(self.key, base64.b64decode(self.vault["check"])) == CHECK
            except InvalidTag:
                ok = False
            if not ok:
                sys.exit("Wrong passphrase.")
            if os.path.exists(self.list_path):
                self.items = json.loads(open_blob(self.key, open(self.list_path, "rb").read()))
        elif create:
            print("No vault yet: creating one. The encrypted files are public, so use 4+ random words.")
            print("If you forget the passphrase, the photos cannot be recovered.")
            if env is not None:
                pw = env
            else:
                pw = getpass.getpass("New passphrase: ")
                if pw != getpass.getpass("Repeat passphrase: "):
                    sys.exit("Passphrases don't match.")
            if len(pw) < 12:
                sys.exit("Use at least 12 characters.")
            self.vault = {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITERATIONS,
                          "salt": base64.b64encode(secrets.token_bytes(16)).decode()}
            self.key = derive_key(pw, self.vault)
            self.vault["check"] = base64.b64encode(seal(self.key, CHECK)).decode()
            with open(self.vault_path, "w") as f:
                f.write(json.dumps(self.vault, indent=2) + "\n")
        else:
            sys.exit(f"No vault.json in {self.dir}. Add some photos first.")

    def save_list(self):
        with open(self.list_path, "wb") as f:
            f.write(seal(self.key, json.dumps(self.items, separators=(",", ":")).encode()))

    def pick(self, numbers):
        out = []
        for n in numbers:
            if not 1 <= n <= len(self.items):
                sys.exit(f"No photo number {n} (there are {len(self.items)}). Use 'list' to see numbers.")
            out.append(self.items[n - 1])
        return out


# ---------- images ----------
def default_caption(path):
    base = os.path.splitext(os.path.basename(path))[0]
    if re.match(r"^(img|dsc|dscn|dscf|pxl|photo|image|mvimg|p)[_\- ]?\d", base, re.I) or re.fullmatch(r"[\d_\- ]+", base):
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[-_]+", " ", base)).strip().title()

def prepare(path, resize):
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
            "gif": "image/gif", "heic": "image/heic", "avif": "image/avif"}
    if not resize:
        ext = os.path.splitext(path)[1].lower().lstrip(".")
        return open(path, "rb").read(), mime.get(ext, "image/jpeg")
    try:
        from PIL import Image, ImageOps
    except ImportError:
        sys.exit("Resizing needs Pillow (pip install pillow), or use --no-resize.")
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass
    try:
        im = Image.open(path)
    except Exception:
        hint = " (for HEIC: pip install pillow-heif)" if path.lower().endswith(".heic") else ""
        raise RuntimeError(f"can't read image{hint}")
    im = ImageOps.exif_transpose(im).convert("RGB")      # apply rotation, drop EXIF/GPS
    im.thumbnail((2048, 2048), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85, optimize=True, progressive=True)
    return buf.getvalue(), "image/jpeg"


# ---------- commands ----------
def cmd_add(v, a):
    v.unlock(create=True)
    os.makedirs(os.path.join(v.dir, "photos"), exist_ok=True)
    added = 0
    for p in a.photos:
        try:
            data, mime = prepare(p, not a.no_resize)
        except (OSError, RuntimeError) as e:
            print(f"  skipped {p}: {e}")
            continue
        rel = f"photos/{secrets.token_hex(8)}.enc"
        with open(os.path.join(v.dir, rel), "wb") as f:
            f.write(seal(v.key, data))
        cap = a.caption if a.caption is not None else default_caption(p)
        v.items.append({"f": rel, "t": mime, "c": cap})
        added += 1
        print(f"  {len(v.items):3}. {os.path.basename(p)} -> {rel}" + (f'  "{cap}"' if cap else ""))
    v.save_list()
    print(f"Added {added}. Now: git add {v.dir} && git commit -m 'Add photos' && git push")

def cmd_list(v, a):
    v.unlock()
    if not v.items:
        print("No photos yet.")
    for i, it in enumerate(v.items, 1):
        print(f"{i:3}. {it['f']}  {it.get('c') or '(no caption)'}")

def cmd_caption(v, a):
    v.unlock()
    v.pick([a.number])[0]["c"] = a.text
    v.save_list()
    print("Caption updated.")

def cmd_remove(v, a):
    v.unlock()
    gone = v.pick(a.numbers)
    v.items = [it for it in v.items if it not in gone]
    for it in gone:
        fp = os.path.join(v.dir, it["f"])
        if os.path.exists(fp):
            os.remove(fp)
        print(f"  removed {it['f']}")
    v.save_list()

def cmd_export(v, a):
    v.unlock()
    os.makedirs(a.folder, exist_ok=True)
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/heic": ".heic", "image/avif": ".avif"}
    for i, it in enumerate(v.items, 1):
        data = open_blob(v.key, open(os.path.join(v.dir, it["f"]), "rb").read())
        name = f"{i:03d}" + (" " + re.sub(r'[\\/:*?"<>|]', "", it["c"]) if it.get("c") else "") + ext.get(it.get("t"), ".jpg")
        with open(os.path.join(a.folder, name), "wb") as f:
            f.write(data)
    print(f"Decrypted {len(v.items)} photos into {a.folder}")


def main():
    ap = argparse.ArgumentParser(description="Manage encrypted slideshow photos.")
    ap.add_argument("--dir", default="slideshow", help="slideshow folder (default: ./slideshow)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("add", help="encrypt and add photos"); p.add_argument("photos", nargs="+")
    p.add_argument("--no-resize", action="store_true", help="keep original files (and their metadata)")
    p.add_argument("--caption", help="caption for all added photos (default: from filename)")
    sub.add_parser("list", help="list photos")
    p = sub.add_parser("caption", help="change a caption"); p.add_argument("number", type=int); p.add_argument("text")
    p = sub.add_parser("remove", help="remove photos"); p.add_argument("numbers", type=int, nargs="+")
    p = sub.add_parser("export", help="decrypt all photos into a folder"); p.add_argument("folder")
    a = ap.parse_args()
    if not os.path.isdir(a.dir):
        sys.exit(f"Folder '{a.dir}' not found. Run from the repo root or pass --dir.")
    {"add": cmd_add, "list": cmd_list, "caption": cmd_caption, "remove": cmd_remove, "export": cmd_export}[a.cmd](Vault(a.dir), a)

if __name__ == "__main__":
    main()
