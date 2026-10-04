import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "android/app/src/main/res"


def png(width: int, height: int, pixel):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixel(x, y, width, height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def icon_pixel(x, y, width, height):
    nx = x / (width - 1)
    ny = y / (height - 1)
    bg = (11, 14, 15, 255)
    if 0.18 < nx < 0.62 and 0.22 < ny < 0.58:
        if abs(nx - 0.18) < 0.012 or abs(nx - 0.62) < 0.012 or abs(ny - 0.22) < 0.012 or abs(ny - 0.58) < 0.012:
            return (24, 244, 234, 255)
    if 0.28 < nx < 0.42 and 0.32 < ny < 0.48:
        if abs(nx - 0.28) < 0.01 or abs(nx - 0.42) < 0.01 or abs(ny - 0.32) < 0.01 or abs(ny - 0.48) < 0.01:
            return (24, 244, 234, 255)
    if abs(ny - 0.72) < 0.012 and 0.16 < nx < 0.84:
        return (240, 213, 106, 255)
    if 0.66 < nx < 0.84 and 0.24 < ny < 0.66:
        if abs(nx - 0.66) < 0.012 or abs(nx - 0.84) < 0.012 or abs(ny - 0.24) < 0.012 or abs(ny - 0.66) < 0.012:
            return (125, 255, 178, 255)
    return bg


def main():
    for folder, size in {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }.items():
        directory = ROOT / folder
        directory.mkdir(parents=True, exist_ok=True)
        data = png(size, size, icon_pixel)
        (directory / "ic_launcher.png").write_bytes(data)
        (directory / "ic_launcher_round.png").write_bytes(data)
        (directory / "ic_launcher_foreground.png").write_bytes(data)


if __name__ == "__main__":
    main()
