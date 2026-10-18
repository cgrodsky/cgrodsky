"""Render preview images of the mini toothbrush with a small z-buffer rasterizer."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "images"
OUT.mkdir(exist_ok=True)
d = np.load(Path(__file__).parent / "mesh_cache.npz")
PARTS = [
    (d["vb"], d["fb"], np.array([0.17, 0.71, 0.66])),
    (d["vt"], d["ft"], np.array([0.62, 0.84, 1.0])),
]


def look_at(eye, target, up=(0, 0, 1)):
    f = target - eye; f /= np.linalg.norm(f)
    r = np.cross(f, up); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return np.stack([r, u, -f])


def render(eye, size=(1200, 800), fov=28, ssaa=2, bed=True, center=(32.0, 0.0, 3.0)):
    W, H = size[0] * ssaa, size[1] * ssaa
    center = np.asarray(center, float)
    eye = np.asarray(eye, float)
    R = look_at(eye, center)
    focal = 0.5 * H / np.tan(np.radians(fov) / 2)
    zbuf = np.full((H, W), np.inf)
    img = np.zeros((H, W, 3))
    # Background gradient.
    g = np.linspace(0, 1, H)[:, None, None]
    img[:] = (1 - g) * np.array([0.93, 0.95, 0.98]) + g * np.array([0.80, 0.84, 0.90])
    light = np.array([-0.4, -0.5, 0.9]); light /= np.linalg.norm(light)
    fill = np.array([0.7, 0.6, 0.3]); fill /= np.linalg.norm(fill)

    tris = []
    if bed:
        # Build plate tile with a grid texture, drawn as quads.
        s = 10.0
        for i in range(-3, 10):
            for j in range(-4, 4):
                x0, y0 = i * s, j * s
                q = np.array([[x0, y0, -0.01], [x0 + s, y0, -0.01], [x0 + s, y0 + s, -0.01], [x0, y0 + s, -0.01]])
                c = np.array([0.24, 0.25, 0.28]) if (i + j) % 2 else np.array([0.27, 0.28, 0.31])
                tris.append((q[[0, 1, 2]], c, True))
                tris.append((q[[0, 2, 3]], c, True))
    for v, f, c in PARTS:
        for t in v[f]:
            tris.append((t, c, False))

    for t, col, is_bed in tris:
        n = np.cross(t[1] - t[0], t[2] - t[0])
        nn = np.linalg.norm(n)
        if nn == 0:
            continue
        n /= nn
        cam = (t - eye) @ R.T
        if np.any(cam[:, 2] >= -1e-3):
            continue
        px = W / 2 + focal * cam[:, 0] / -cam[:, 2]
        py = H / 2 - focal * cam[:, 1] / -cam[:, 2]
        depth = -cam[:, 2]
        x0, x1 = int(max(np.floor(px.min()), 0)), int(min(np.ceil(px.max()), W - 1))
        y0, y1 = int(max(np.floor(py.min()), 0)), int(min(np.ceil(py.max()), H - 1))
        if x0 > x1 or y0 > y1:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, bx, cx), (ay, by, cy) = px, py
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12:
            continue
        w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        z = 1.0 / (w0 / depth[0] + w1 / depth[1] + w2 / depth[2])
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        m = inside & (z < sub)
        if not m.any():
            continue
        view = eye - t.mean(0); view /= np.linalg.norm(view)
        if is_bed:
            shade = col
        else:
            if n @ view < 0:
                n = -n
            diff = max(n @ light, 0) * 0.75 + max(n @ fill, 0) * 0.2 + 0.18
            h = light + view; h /= np.linalg.norm(h)
            spec = max(n @ h, 0) ** 40 * 0.35
            rim = (1 - max(n @ view, 0)) ** 3 * 0.15
            shade = np.clip(col * diff + spec + rim, 0, 1)
        sub[m] = z[m]
        img[y0:y1 + 1, x0:x1 + 1][m] = shade

    im = Image.fromarray((img * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    return im


def label(im, text):
    dr = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    except OSError:
        font = ImageFont.load_default()
    dr.text((28, 22), text, fill=(30, 34, 44), font=font)
    return im


VIEWS = {
    "hero": ((-25, -70, 45), "Mini Toothbrush - 73 mm"),
    "side": ((32, -110, 6), "Side profile"),
    "top": ((32, -0.01, 130), "Top view"),
    "head_closeup": ((90, -32, 28), "Bristle head close-up", (56.0, 0.0, 4.0), 30),
}

if __name__ == "__main__":
    for name, (eye, title, *extra) in VIEWS.items():
        kw = dict(center=extra[0], fov=extra[1]) if extra else {}
        im = render(eye, bed=name != "top", **kw)
        label(im, title).save(OUT / f"{name}.png")
        print("wrote", name)
    render(VIEWS["hero"][0], size=(512, 512), ssaa=2).save(OUT / "thumbnail.png")
