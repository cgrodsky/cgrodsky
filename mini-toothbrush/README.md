# Mini Toothbrush

A 73 × 10 × 8.7 mm mini toothbrush (keychain hole, grip dimples, 21 bristle tufts).
It prints flat on the bed with the tufts pointing up, so it needs no supports.

| File | What it is |
| --- | --- |
| `mini_toothbrush.3mf` | Model: handle and bristles as two coloured parts of one object. PrusaSlicer settings are embedded. |
| `profiles/mini_toothbrush_prusaslicer.ini` | PrusaSlicer / SuperSlicer print profile |
| `profiles/mini_toothbrush_orca_bambu_process.json` | OrcaSlicer / Bambu Studio process preset |
| `profiles/mini_toothbrush_orca_bambu_filament.json` | OrcaSlicer / Bambu Studio PLA filament preset (cooling for the tufts) |
| `images/` | Preview renders |
| `make_model.py`, `render.py` | Scripts that regenerate the model and images |

## Print settings at a glance

- PLA, 0.4 mm nozzle, 0.12 mm layers (0.2 mm first layer)
- 3 walls, 25 % gyroid infill, 6 top / 4 bottom layers
- Slow outer walls (20 mm/s) and small perimeters (15 mm/s) for the 1.6 mm tufts
- Fan 100 %, minimum layer time 12 s so the tufts cool between layers
- 3 mm outer brim, no supports
- Optional two-tone: add a colour change at Z = 2.76 mm (top of the head) for white or blue bristles

The tufts are solid plastic, so this is a novelty or display piece, not a working toothbrush.

## Regenerating

```sh
pip install numpy manifold3d pillow
python3 make_model.py   # writes the 3MF and mesh_cache.npz
python3 render.py       # writes images/
python3 make_model.py   # re-run to embed the new thumbnail
```
