package com.cgrodsky.adminessentials.data;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.saveddata.SavedData;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

public final class WarpData extends SavedData {
    public static final String NAME = "adminessentials_warps";

    public record Warp(ResourceKey<Level> dim, double x, double y, double z, float yaw, float pitch) {
        public CompoundTag write() {
            CompoundTag t = new CompoundTag();
            t.putString("dim", dim.location().toString());
            t.putDouble("x", x); t.putDouble("y", y); t.putDouble("z", z);
            t.putFloat("yaw", yaw); t.putFloat("pitch", pitch);
            return t;
        }
        public static Warp read(CompoundTag t) {
            ResourceKey<Level> dim = ResourceKey.create(net.minecraft.core.registries.Registries.DIMENSION,
                    new ResourceLocation(t.getString("dim")));
            return new Warp(dim, t.getDouble("x"), t.getDouble("y"), t.getDouble("z"),
                    t.getFloat("yaw"), t.getFloat("pitch"));
        }
    }

    private final Map<String, Warp> warps = new HashMap<>();

    public WarpData() {}

    public static WarpData get(ServerLevel level) {
        return level.getServer().overworld().getDataStorage().computeIfAbsent(
                new Factory<>(WarpData::new, WarpData::load, null), NAME);
    }

    public void set(String name, Warp w) { warps.put(name.toLowerCase(), w); setDirty(); }
    public Warp get(String name) { return warps.get(name.toLowerCase()); }
    public boolean remove(String name) { boolean ok = warps.remove(name.toLowerCase()) != null; if (ok) setDirty(); return ok; }
    public Set<String> names() { return warps.keySet(); }

    @Override
    public CompoundTag save(CompoundTag tag) {
        ListTag list = new ListTag();
        warps.forEach((name, w) -> {
            CompoundTag entry = w.write();
            entry.putString("name", name);
            list.add(entry);
        });
        tag.put("warps", list);
        return tag;
    }

    public static WarpData load(CompoundTag tag) {
        WarpData d = new WarpData();
        ListTag list = tag.getList("warps", Tag.TAG_COMPOUND);
        for (int i = 0; i < list.size(); i++) {
            CompoundTag entry = list.getCompound(i);
            d.warps.put(entry.getString("name"), Warp.read(entry));
        }
        return d;
    }
}
