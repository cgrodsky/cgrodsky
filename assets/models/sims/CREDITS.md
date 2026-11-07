# Sims 3D model credits

## Plumbob (`plumbob.stl`, `plumbob_top_print.stl`, `plumbob_bottom_print.stl`)
"The Sims Plumbob" by Thingiverse user **ordinarycontraptions**,
https://www.thingiverse.com/thing:5275829, licensed under
Creative Commons Attribution-NonCommercial-ShareAlike (CC BY-NC-SA).

Changes made here:
- The headband parts were removed: the `small_hollow_cylinder` piece is gone, and so is the
  wire stub on the bottom tip of the lower half.
- `plumbob.stl` is a solid, game-ready version with no headband (12 faces, centred, Y up, 1 unit = 1 mm),
  taken from the original's measurements: a regular hexagon with radius 34.641 and a tip height of 70.680 per half.
- `plumbob_top_print.stl` is the original no-holes top half. `plumbob_bottom_print.stl` is that half
  mirrored, so the bottom has no wire hole or stub.

These derivative files are shared under the same CC BY-NC-SA license.

## From CGTrader (https://www.cgtrader.com/)
Used under each model's CGTrader license. The original model files are not shared here. Each one was
converted into a small `.glb` that is only used inside the game.

| File | Model | Changes |
|---|---|---|
| `lamp.glb` | Table lamp (Blender OBJ) | Cut from 47k to 4.6k triangles; new materials for the ceramic base and fabric shade; 0.67 m tall |
| `cupandsaucer.glb` | Cup and saucer (OBJ) | Smooth shading; porcelain and tea materials; 6 cm wide |
| `curtains.glb` | Curtains (3ds Max FBX) | Stood upright; cut from 235k to 9.4k triangles; the original textures were missing, so it uses plain fabric and sheer materials; 2.6 m tall |
| `wineglass.glb` | Crystal wine glass (Rhino/MoI 3DM, NURBS only) | Surfaces turned into triangles and the flat untrimmed patches dropped; glass and wine materials; 17 cm tall |
| `house.glb` | House (3DS) | Stood upright; the black placeholder materials were remapped to roof, siding, trim, glass, floors and counters; double-sided; 1 unit = 1 m |

Author names and links still need to be added for these models.

### Sofa collection (`sofas/`, from CGTrader)
36 sofas, loveseats, sectionals, chaises, armchairs and ottomans. The original files were Portuguese-named GLB, OBJ and
Blend files, about 575 MB. Each GLB was flattened, welded and simplified to about 6k triangles. The textures were cut
to 256 px JPEG, or replaced with their average color where the texture seams blocked the simplifier. Each model was
set on the floor (y = 0) and centered. All 36 together are 4.8 MB. `sofas/catalog.json` (and the full `catalog.json`, which covers every model) gives each one an English
name, a type, a seat count, a comfort rating and a Buy-mode price.

### Teak beach deck chair (`deckchair.glb`, from CGTrader, "Sun-lounger_CYCLES.blend")
Read straight from the Blender 3.0 file with a small .blend parser (`Sun lounger*` objects only). The hidden character
reference meshes, the screws and the bolts were left out. The Z-up axis was changed to Y-up, and the wood, canvas,
leather and suede colors were set by hand. Cut from 28.8k to 5.8k triangles with sharp edges kept on the wood.
0.92 × 0.81 × 0.87 m, 123 KB.

### Striped seaside deck chair (`deckchair-striped.glb`, from CGTrader, "deck_chair.zip")
The FBX (1.6k triangles) plus its albedo texture, cut from a 4.6 MB PNG to a 512 px JPEG. The normal, AO, roughness and
metallic maps were left out to keep it light. Scaled to 0.9 m tall, 82 KB.

### A-frame porch swing (`porchswing.glb`) by **masonreloaded** (https://www.cgtrader.com/designers/masonreloaded)
`jm_porch_swing.fbx`. The ground plane was removed. The chains alone were 98k triangles, so the whole swing was cut from
110k to 15k triangles. The textures weren't included, so it uses a cedar wood color and dark steel chains. Scaled to
2.1 m tall, 372 KB.

### Oak barrel (`barrel.glb`) by **margetacg** (https://www.cgtrader.com/designers/margetacg)
`bure_final-cgtrader.fbx` ("bure" means barrel), 6.5k triangles. The base-color texture wasn't included, so each
separate part was sorted by shape: the thin rings are the iron hoops, the small parts are the rivets, and everything else
is the oak staves, lid and plug. Smooth shading with crisp edges, cut to 4.6k triangles. Scaled to 0.85 m tall, 108 KB.

### Retro CRT TV with lace doily (`crt-tv.glb`) by **nykonni** (https://www.cgtrader.com/designers/nykonni)
`TV THT3.abc` (Alembic) plus a front photo texture and a doily texture. Read straight from the Alembic/Ogawa file with a
small parser (meshes, UVs, transform hierarchy; the power-cord curve was skipped). The real-brand logos in the front
photo were painted out. The doily's lace holes come from an alpha channel made from its brightness. Textures cut to
512 px. 0.88 × 0.66 × 0.66 m, 252 KB.
