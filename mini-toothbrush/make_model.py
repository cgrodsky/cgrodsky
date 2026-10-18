"""Generate a mini toothbrush model and write it to a 3MF file.

Units are millimetres. The brush lies flat on the bed (z=0) with the
bristle tufts pointing up, so it prints without supports.
"""
import io
import zipfile
from pathlib import Path

import numpy as np
from manifold3d import Manifold, CrossSection

OUT = Path(__file__).parent
SEG = 48  # circle resolution

# Spine of the brush: (x, half-width, height) stations from handle end to head.
HANDLE = [
    (0.0, 4.6, 5.2),
    (10.0, 5.0, 5.6),
    (24.0, 4.4, 5.0),
    (36.0, 3.2, 4.0),
    (44.0, 2.3, 3.2),   # neck
    (50.0, 2.4, 3.0),
]
HEAD_X0, HEAD_X1 = 49.0, 68.0
HEAD_HALF_W = 4.0
HEAD_H = 2.8
TUFT_R = 0.8
TUFT_H = 5.0


def ellipsoid(rx, ry, rz):
    return Manifold.sphere(1.0, SEG).scale((rx, ry, rz))


def handle_body():
    # Hull consecutive flattened ellipsoids for a smooth tapered handle;
    # centred on z=0 then cut in half so the bottom is flat.
    parts = []
    for (x0, w0, h0), (x1, w1, h1) in zip(HANDLE, HANDLE[1:]):
        a = ellipsoid(w0, w0, h0).translate((x0, 0, 0))
        b = ellipsoid(w1, w1, h1).translate((x1, 0, 0))
        parts.append(Manifold.batch_hull([a, b]))
    body = Manifold.batch_boolean(parts, 0)  # union
    return body


def head_body():
    # Rounded-rectangle head plate, flat top for the tufts.
    r = HEAD_HALF_W
    xs = CrossSection.circle(r, SEG)
    plate2d = CrossSection.batch_hull([
        xs.translate((HEAD_X0 + r, 0)), xs.translate((HEAD_X1 - r, 0))
    ])
    return plate2d.extrude(HEAD_H)


def tufts():
    out = []
    rows = [-2.2, 0.0, 2.2]
    cols = np.linspace(HEAD_X0 + 2.2, HEAD_X1 - 2.2, 7)
    for i, x in enumerate(cols):
        for j, y in enumerate(rows):
            # Middle row slightly taller, front tufts taller -> classic profile.
            h = TUFT_H + (0.5 if j == 1 else 0.0) + 0.6 * (i == len(cols) - 1)
            stem = Manifold.cylinder(h - TUFT_R, TUFT_R, TUFT_R, SEG // 2)
            cap = Manifold.sphere(TUFT_R, SEG // 2).translate((0, 0, h - TUFT_R))
            t = (stem + cap).translate((x, y, HEAD_H - 0.2))
            out.append(t)
    return Manifold.batch_boolean(out, 0)


def keyring_hole(body):
    hole = Manifold.cylinder(20, 1.6, 1.6, SEG).translate((4.2, 0, -5))
    return body - hole


def build():
    body = handle_body() + head_body()
    # Grip dimples along the top of the handle.
    for k, x in enumerate([14.0, 18.0, 22.0]):
        d = Manifold.sphere(1.6, SEG).scale((1.0, 2.2, 1.0)).translate((x, 0, 5.5 - 0.2 * k))
        body = body - d
    body = keyring_hole(body)
    # Flat bottom: keep only z >= 0.
    keep = Manifold.cube((200, 50, 50)).translate((-50, -25, 0))
    body = body ^ keep
    bristles = tufts()
    return body, bristles


def to_arrays(m):
    mesh = m.to_mesh()
    v = np.asarray(mesh.vert_properties)[:, :3].astype(np.float64)
    f = np.asarray(mesh.tri_verts).astype(np.int64)
    return v, f


def write_3mf(path, objects):
    """objects: list of (name, verts, faces, hex_color)."""
    mats = "".join(
        f'<base name="{n}" displaycolor="{c}"/>' for n, _, _, c in objects)
    res, items = [], []
    for i, (name, v, f, _) in enumerate(objects, start=2):
        vx = "".join(f'<vertex x="{a:.4f}" y="{b:.4f}" z="{c:.4f}"/>' for a, b, c in v)
        tx = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in f)
        res.append(
            f'<object id="{i}" name="{name}" type="model" pid="1" pindex="{i-2}">'
            f'<mesh><vertices>{vx}</vertices><triangles>{tx}</triangles></mesh></object>')
    # Group both parts into one build object so slicers treat it as a single print.
    comps = "".join(f'<component objectid="{i}"/>' for i in range(2, 2 + len(objects)))
    cid = 2 + len(objects)
    res.append(f'<object id="{cid}" name="Mini Toothbrush" type="model"><components>{comps}</components></object>')
    items.append(f'<item objectid="{cid}" transform="1 0 0 0 1 0 0 0 1 90 100 0"/>')
    model = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
        '<metadata name="Title">Mini Toothbrush</metadata>'
        '<metadata name="Designer">grodsky</metadata>'
        '<metadata name="Description">70 mm mini toothbrush, prints flat with no supports.</metadata>'
        f'<resources><basematerials id="1">{mats}</basematerials>{"".join(res)}</resources>'
        f'<build>{"".join(items)}</build></model>')
    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
        '<Default Extension="png" ContentType="image/png"/>'
        '<Default Extension="config" ContentType="text/plain"/>'
        '</Types>')
    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
        'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
        '<Relationship Target="/Metadata/thumbnail.png" Id="rel1" '
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>'
        '</Relationships>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("3D/3dmodel.model", model)
        thumb = OUT / "images" / "thumbnail.png"
        if thumb.exists():
            z.write(thumb, "Metadata/thumbnail.png")
        # PrusaSlicer reads embedded settings from this file when the 3MF is opened.
        ini = OUT / "profiles" / "mini_toothbrush_prusaslicer.ini"
        if ini.exists():
            # The embedded copy uses PrusaSlicer's "; key = value" 3MF format.
            lines = [ln.strip() for ln in ini.read_text().splitlines()]
            cfg = [f"; {ln}" for ln in lines if ln and not ln.startswith("#")]
            z.writestr("Metadata/Slic3r_PE.config",
                       "; generated for Mini Toothbrush\n\n" + "\n".join(cfg) + "\n")


def main():
    body, bristles = build()
    for name, m in [("body", body), ("bristles", bristles)]:
        print(f"{name}: volume {m.volume():.1f} mm^3, genus {m.genus()}, status {m.status()}")
    bb = (body + bristles).bounding_box()
    print("bounding box:", [round(x, 2) for x in bb])
    vb, fb = to_arrays(body)
    vt, ft = to_arrays(bristles)
    np.savez(OUT / "mesh_cache.npz", vb=vb, fb=fb, vt=vt, ft=ft)
    write_3mf(OUT / "mini_toothbrush.3mf", [
        ("Handle", vb, fb, "#2BB5A8FF"),
        ("Bristles", vt, ft, "#9ED6FFFF"),
    ])
    print("wrote", OUT / "mini_toothbrush.3mf")


if __name__ == "__main__":
    main()
