#!/usr/bin/env python3
"""Pembangun fixtures PDF untuk Document Intelligence D2 (impor PDF).

Menulis PDF minimal yang valid secara manual (tanpa pustaka PDF) agar
keluaran deterministik: objek ditulis berurutan, xref dihitung dari
offset byte yang sebenarnya, stream memakai FlateDecode (zlib).

Fixtures:
  pdf-simple.pdf    1 halaman, 2 paragraf (4 baris) — jarak antarparagraf
                    dibuat lewat lompatan vertikal 22pt vs leading 14pt.
  pdf-multipage.pdf 3 halaman, teks berbeda per halaman.
  pdf-twocol.pdf    dua kolom pada y yang sama — kasus ekstraksi tidak
                    sempurna: pembaca geometris membaca menyilang per baris.
  pdf-scan.pdf      satu halaman hanya berisi persegi terisi (tiruan hasil
                    pindaian): tidak ada operator teks sama sekali.
  pdf-corrupt.pdf   header %PDF- diikuti isi sampah — bukan PDF valid.
  pdf-encrypted.pdf Standard Security Handler revisi 2 (RC4 40-bit),
                    kata sandi pengguna "rahasia" — pdf.js harus menolak
                    dengan PasswordException.
"""
import hashlib
import struct
import zlib
import os

OUT = os.path.dirname(os.path.abspath(__file__))


def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def stream_body(data, extra=b""):
    comp = zlib.compress(data)
    return (b"<< /Length " + str(len(comp)).encode() +
            b" /Filter /FlateDecode " + extra + b">>\nstream\n" + comp + b"\nendstream")


def write_pdf(path, objects, trailer_extra=b""):
    out = b"%PDF-1.4\n"
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += str(i).encode() + b" 0 obj\n" + body + b"\nendobj\n"
    xref_pos = len(out)
    n = len(objects) + 1
    out += b"xref\n0 " + str(n).encode() + b"\n0000000000 65535 f \n"
    for off in offsets:
        out += ("%010d 00000 n \n" % off).encode()
    out += (b"trailer\n<< /Size " + str(n).encode() + b" /Root 1 0 R " +
            trailer_extra + b">>\nstartxref\n" + str(xref_pos).encode() + b"\n%%EOF\n")
    with open(path, "wb") as f:
        f.write(out)
    return len(out)


FONT = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"


def text_content(lines):
    """lines: daftar perintah show yang sudah diformat sebagai aliran BT..ET."""
    return ("\n".join(lines)).encode("ascii")


def page_obj(parent, contents_ref):
    return (b"<< /Type /Page /Parent " + str(parent).encode() +
            b" 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents " +
            str(contents_ref).encode() + b" 0 R >>")


# ---------------------------------------------------------------- simple
simple_lines = [
    "BT /F1 11 Tf 56 720 Td 14 TL",
    "(" + esc("Dokumen PDF sederhana untuk pengujian impor teks.") + ") Tj",
    "T*",
    "(" + esc("Baris kedua ini masih satu paragraf dengan baris di atasnya.") + ") Tj",
    "0 -22 Td 14 TL",
    "(" + esc("Paragraf kedua dimulai setelah jarak vertikal yang besar.") + ") Tj",
    "T*",
    "(" + esc("Baris penutup paragraf kedua pada halaman yang sama.") + ") Tj",
    "ET",
]
write_pdf(os.path.join(OUT, "pdf-simple.pdf"), [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    page_obj(2, 5),
    FONT,
    stream_body(text_content(simple_lines)),
])

# ---------------------------------------------------------------- multipage
mp_texts = [
    ("Halaman pertama berisi teks pembuka dokumen.", "Isi halaman satu selesai pada baris ini."),
    ("Halaman kedua berisi teks tengah dokumen.", "Isi halaman dua selesai pada baris ini."),
    ("Halaman ketiga berisi teks penutup dokumen.", "Isi halaman tiga selesai pada baris ini."),
]
mp_objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
]
# objek: 3,5,7 = halaman; 4 = font; 6,8,10 = isi. Font harus nomor 4 -> susun ulang:
mp_objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
    page_obj(2, 9),   # halaman 1 -> isi objek 9
    FONT,             # objek 4
    page_obj(2, 10),  # halaman 2 -> isi objek 10
    b"placeholder",   # objek 6 (diganti di bawah)
    page_obj(2, 11),  # halaman 3 -> isi objek 11
    b"placeholder",   # objek 8 (diganti di bawah)
]
contents = []
for a, b in mp_texts:
    contents.append(stream_body(text_content([
        "BT /F1 11 Tf 56 720 Td 14 TL",
        "(" + esc(a) + ") Tj",
        "T*",
        "(" + esc(b) + ") Tj",
        "ET",
    ])))
mp_objects[5] = b"<< /Annots [] >>"  # objek 6 netral (tidak dirujuk)
mp_objects[7] = b"<< /Annots [] >>"  # objek 8 netral (tidak dirujuk)
mp_objects += contents  # objek 9, 10, 11
write_pdf(os.path.join(OUT, "pdf-multipage.pdf"), mp_objects)

# ---------------------------------------------------------------- twocol
twocol_lines = [
    "BT /F1 11 Tf 56 720 Td",
    "(" + esc("Kolom kiri baris pertama.") + ") Tj",
    "0 -14 Td",
    "(" + esc("Kolom kiri baris kedua.") + ") Tj",
    "ET",
    "BT /F1 11 Tf 310 720 Td",
    "(" + esc("Kolom kanan baris pertama.") + ") Tj",
    "0 -14 Td",
    "(" + esc("Kolom kanan baris kedua.") + ") Tj",
    "ET",
]
write_pdf(os.path.join(OUT, "pdf-twocol.pdf"), [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    page_obj(2, 5),
    FONT,
    stream_body(text_content(twocol_lines)),
])

# ---------------------------------------------------------------- scan
write_pdf(os.path.join(OUT, "pdf-scan.pdf"), [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    page_obj(2, 5),
    FONT,
    stream_body(b"0.85 g 56 560 220 140 re f\n0.7 g 56 380 220 140 re f"),
])

# ---------------------------------------------------------------- corrupt
with open(os.path.join(OUT, "pdf-corrupt.pdf"), "wb") as f:
    f.write(b"%PDF-1.4\n" + b"ini bukan badan pdf yang valid sama sekali " * 24 + b"\n%%EOF\n")

# ---------------------------------------------------------------- encrypted
PADDING = bytes.fromhex(
    "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a")


def rc4(key, data):
    s = list(range(256))
    j = 0
    for i in range(256):
        j = (j + s[i] + key[i % len(key)]) & 0xFF
        s[i], s[j] = s[j], s[i]
    out = bytearray()
    i = j = 0
    for byte in data:
        i = (i + 1) & 0xFF
        j = (j + s[i]) & 0xFF
        s[i], s[j] = s[j], s[i]
        out.append(byte ^ s[(s[i] + s[j]) & 0xFF])
    return bytes(out)


def pad32(pw):
    return (pw.encode("latin-1") + PADDING)[:32]


USER_PW = "rahasia"
OWNER_PW = "pemilik"
PERMS = -4
FILE_ID = b"SaksaraD2Fixture"  # 16 byte

owner_key = hashlib.md5(pad32(OWNER_PW)).digest()[:5]
o_val = rc4(owner_key, pad32(USER_PW))
file_key = hashlib.md5(pad32(USER_PW) + o_val + struct.pack("<i", PERMS) + FILE_ID).digest()[:5]
u_val = rc4(file_key, PADDING)


def obj_key(objnum):
    return hashlib.md5(file_key + objnum.to_bytes(3, "little") + (0).to_bytes(2, "little")).digest()[:10]


enc_plain = text_content([
    "BT /F1 11 Tf 56 720 Td",
    "(" + esc("Dokumen terenkripsi tidak dapat dibaca tanpa kata sandi.") + ") Tj",
    "ET",
])
enc_comp = zlib.compress(enc_plain)
enc_stream = (b"<< /Length " + str(len(enc_comp)).encode() +
              b" /Filter /FlateDecode >>\nstream\n" + rc4(obj_key(5), enc_comp) + b"\nendstream")
encrypt_dict = (b"<< /Filter /Standard /V 1 /R 2 /Length 40 /O <" + o_val.hex().encode() +
                b"> /U <" + u_val.hex().encode() + b"> /P " + str(PERMS).encode() + b" >>")
write_pdf(os.path.join(OUT, "pdf-encrypted.pdf"), [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    page_obj(2, 5),
    FONT,
    enc_stream,
    encrypt_dict,
], trailer_extra=b"/Encrypt 6 0 R /ID [<" + FILE_ID.hex().encode() + b"><" + FILE_ID.hex().encode() + b">] ")

print("fixtures PDF ditulis ke", OUT)
