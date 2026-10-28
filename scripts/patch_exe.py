#!/usr/bin/env python3
"""
Replace the icon and the version text (name shown in Task Manager / file properties)
inside a Windows .exe, in place, without external tools.

Icons: each RT_ICON slot keeps its byte size; our PNG is padded with an ignored
PNG chunk to fill it exactly. Version: VS_VERSIONINFO is rebuilt and must fit in the
original resource size.

usage: patch_exe.py <exe> <icon.png (square, >=256px)> <name> <version> [--dump]
"""
import io, struct, sys, zlib
from PIL import Image

RT_ICON, RT_GROUP_ICON, RT_VERSION = 3, 14, 16


class PE:
    def __init__(self, data):
        self.d = data
        e = struct.unpack_from('<I', data, 0x3C)[0]
        assert data[e:e + 4] == b'PE\0\0'
        nsec, = struct.unpack_from('<H', data, e + 6)
        optsz, = struct.unpack_from('<H', data, e + 20)
        opt = e + 24
        magic, = struct.unpack_from('<H', data, opt)
        dd = opt + (112 if magic == 0x20B else 96)
        self.dd = dd
        self.res_rva, self.res_size = struct.unpack_from('<II', data, dd + 2 * 8)
        self.secs = []
        so = opt + optsz
        for i in range(nsec):
            o = so + i * 40
            vsize, va, rawsize, rawptr = struct.unpack_from('<IIII', data, o + 8)
            self.secs.append((va, max(vsize, rawsize), rawptr))

    def off(self, rva):
        for va, size, raw in self.secs:
            if va <= rva < va + size:
                return rva - va + raw
        raise ValueError('rva %x' % rva)

    def entries(self):
        """yield (type, name, lang, data_entry_file_offset, data_file_offset, size)"""
        base = self.off(self.res_rva)
        d = self.d

        def dir_items(o):
            nnamed, nid = struct.unpack_from('<HH', d, o + 12)
            for i in range(nnamed + nid):
                name, target = struct.unpack_from('<II', d, o + 16 + i * 8)
                yield (name & 0x7FFFFFFF if not name & 0x80000000 else ('str', name & 0x7FFFFFFF)), target

        for t, tt in dir_items(base):
            for n, nt in dir_items(base + (tt & 0x7FFFFFFF)):
                for l, lt in dir_items(base + (nt & 0x7FFFFFFF)):
                    de = base + lt
                    rva, size = struct.unpack_from('<II', d, de)
                    yield t, n, l, de, self.off(rva), size


def png_bytes(img, level):
    b = io.BytesIO()
    img.save(b, 'PNG', compress_level=level, optimize=(level == 9))
    return b.getvalue()


def fit_png(img, slot):
    """PNG of exactly `slot` bytes, or None if it can't fit"""
    cands = [img]
    q = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE)  # palette fallback for tight slots
    cands.append(q)
    for im in cands:
        for level in (9, 8, 7, 6, 5, 4, 3, 2, 1):
            p = png_bytes(im, level)
            pad = slot - len(p)
            if pad == 0:
                return p
            if pad >= 12:
                body = b'\0' * (pad - 12)
                chunk = struct.pack('>I', len(body)) + b'zpAD' + body
                chunk += struct.pack('>I', zlib.crc32(b'zpAD' + body) & 0xFFFFFFFF)
                return p[:-12] + chunk + p[-12:]          # before IEND
    return None


def u16(s):
    return s.encode('utf-16-le') + b'\0\0'


def block(key, value=b'', vtype=1, children=b'', vlen=None):
    """one VS_VERSIONINFO-style node (aligned to 4 bytes)"""
    hdr_key = u16(key)
    head = 6 + len(hdr_key)
    pad1 = (4 - head % 4) % 4
    body = value
    pad2 = (4 - (head + pad1 + len(body)) % 4) % 4 if children else 0
    total = head + pad1 + len(body) + pad2 + len(children)
    if vlen is None:
        vlen = len(value) // 2 if vtype == 1 else len(value)
    out = struct.pack('<HHH', total, vlen, vtype) + hdr_key + b'\0' * pad1 + body + b'\0' * pad2 + children
    out += b'\0' * ((4 - len(out) % 4) % 4)
    return out


def version_resource(old, name, ver):
    # keep VS_FIXEDFILEINFO from the original, with our version numbers
    i = old.find(struct.pack('<I', 0xFEEF04BD))
    ffi = bytearray(old[i:i + 52])
    nums = [int(x) for x in (ver.split('.') + ['0', '0', '0'])[:4]]
    ms, ls = (nums[0] << 16) | nums[1], (nums[2] << 16) | nums[3]
    struct.pack_into('<IIII', ffi, 8, ms, ls, ms, ls)
    strings = [('CompanyName', '3zo'), ('FileDescription', name), ('FileVersion', ver),
               ('InternalName', name), ('LegalCopyright', '3zo'), ('OriginalFilename', name + '.exe'),
               ('ProductName', name), ('ProductVersion', ver)]
    st = b''.join(block(k, u16(v)) for k, v in strings)
    sfi = block('StringFileInfo', children=block('040904b0', children=st))
    vfi = block('VarFileInfo', children=block('Translation', struct.pack('<HH', 0x0409, 1200), vtype=0))
    return block('VS_VERSION_INFO', bytes(ffi), vtype=0, children=sfi + vfi, vlen=52)


def main():
    exe, icon, name, ver = sys.argv[1:5]
    data = bytearray(open(exe, 'rb').read())
    pe = PE(data)
    ents = list(pe.entries())
    if '--dump' in sys.argv:
        for t, n, l, de, off, size in ents:
            if t in (RT_ICON, RT_GROUP_ICON, RT_VERSION):
                print('type', t, 'name', n, 'lang', l, 'size', size)
    src = Image.open(icon).convert('RGBA')

    # group icons: (width, height, id) for every icon slot
    ok = 0
    for t, n, l, de, off, size in ents:
        if t != RT_GROUP_ICON:
            continue
        count, = struct.unpack_from('<H', data, off + 4)
        for k in range(count):
            e = off + 6 + k * 14
            w, h, cc, rsv, planes, bits, nbytes, iid = struct.unpack_from('<BBBBHHIH', data, e)
            px = w or 256
            slot = next((x for x in ents if x[0] == RT_ICON and x[1] == iid), None)
            if not slot:
                continue
            _, _, _, sde, soff, ssize = slot
            img = src.resize((px, px), Image.LANCZOS)
            p = fit_png(img, ssize)
            if p is None:
                print('icon %dpx: does not fit in %d bytes, kept original' % (px, ssize))
                continue
            data[soff:soff + ssize] = p
            struct.pack_into('<BBBBHHIH', data, e, w, h, 0, 0, 1, 32, ssize, iid)
            ok += 1
    print('icons replaced:', ok)

    for t, n, l, de, off, size in ents:
        if t != RT_VERSION:
            continue
        new = version_resource(bytes(data[off:off + size]), name, ver)
        if len(new) > size:
            print('version info too big, kept original')
            continue
        data[off:off + size] = new + b'\0' * (size - len(new))
        struct.pack_into('<I', data, de + 4, len(new))
        print('version info replaced')

    # the original digital signature no longer matches the changed file: remove it cleanly
    cert_off, cert_size = struct.unpack_from('<II', data, pe.dd + 4 * 8)
    if cert_off and cert_off + cert_size == len(data):
        del data[cert_off:]
        struct.pack_into('<II', data, pe.dd + 4 * 8, 0, 0)
        print('old signature removed')

    open(exe, 'wb').write(data)


if __name__ == '__main__':
    main()
