"""Build sliced Bambu Studio project files (.3mf) for each printer.

Runs the Bambu Studio command line with fully expanded
printer, process and filament presets, so the result is a project Bambu
Studio itself wrote: open it and the printer, process and filament are set.

    python3 build_projects.py <BambuStudio profiles/BBL dir> <out dir> [bambu-studio command]
"""
import json
import subprocess
import sys
from pathlib import Path

import generate

HERE = Path(__file__).parent
MODEL = HERE.parent.parent / "mini_toothbrush.3mf"


def full_preset(idx, kind, name):
    d = generate.resolve(idx, kind, name)
    d.pop("inherits", None)
    d.pop("instantiation", None)
    return d


def main(bbl, out, exe="bambu-studio"):
    bbl, out = Path(bbl), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    idx = generate.load_index(bbl)
    for folder, (printer, process, filament, _) in generate.PRINTERS.items():
        work = out / "work" / folder
        work.mkdir(parents=True, exist_ok=True)
        machine = full_preset(idx, "machine", printer)
        machine["from"] = "system"
        user_proc = json.loads((HERE / folder / f"Mini Toothbrush 0.12mm @ {folder.replace('_', ' ')}.json").read_text())
        user_fil = json.loads((HERE / folder / f"Mini Toothbrush PLA @ {folder.replace('_', ' ')}.json").read_text())
        proc = {**full_preset(idx, "process", process), **user_proc}
        fil = {**full_preset(idx, "filament", filament), **user_fil}
        paths = {}
        for key, data in (("machine", machine), ("process", proc), ("filament", fil)):
            paths[key] = work / f"{key}.json"
            paths[key].write_text(json.dumps(data, indent=4))
        target = out / f"Mini Toothbrush - {folder.replace('_', ' ')}.3mf"
        cmd = [exe, "--load-settings", f"{paths['machine']};{paths['process']}",
               "--load-filaments", str(paths["filament"]),
               "--arrange", "1", "--orient", "0", "--slice", "0",
               "--outputdir", str(work), "--export-3mf", target.name, str(MODEL)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        produced = work / target.name
        if r.returncode or not produced.exists():
            print(f"{folder}: FAILED ({r.returncode})\n{r.stdout[-1500:]}\n{r.stderr[-1500:]}")
            continue
        produced.replace(target)
        print(f"{folder}: ok -> {target.name}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
