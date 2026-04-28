package com.cgrodsky.adminessentials.data;

import net.minecraft.core.BlockPos;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.saveddata.SavedData;

public final class SpawnProtection extends SavedData {
    public static final String NAME = "adminessentials_spawn_protection";

    private boolean enabled;
    private int x1, y1, z1, x2, y2, z2;

    public SpawnProtection() {}

    public static SpawnProtection get(ServerLevel level) {
        return level.getServer().overworld().getDataStorage().computeIfAbsent(
                new Factory<>(SpawnProtection::new, SpawnProtection::load, null), NAME);
    }

    public boolean isEnabled() { return enabled; }

    public void clear() { enabled = false; setDirty(); }

    public void set(BlockPos a, BlockPos b) {
        x1 = Math.min(a.getX(), b.getX()); y1 = Math.min(a.getY(), b.getY()); z1 = Math.min(a.getZ(), b.getZ());
        x2 = Math.max(a.getX(), b.getX()); y2 = Math.max(a.getY(), b.getY()); z2 = Math.max(a.getZ(), b.getZ());
        enabled = true;
        setDirty();
    }

    public boolean contains(BlockPos pos) {
        if (!enabled) return false;
        return pos.getX() >= x1 && pos.getX() <= x2
            && pos.getY() >= y1 && pos.getY() <= y2
            && pos.getZ() >= z1 && pos.getZ() <= z2;
    }

    public String describe() {
        if (!enabled) return "(none)";
        return "(" + x1 + "," + y1 + "," + z1 + ") to (" + x2 + "," + y2 + "," + z2 + ")";
    }

    @Override
    public CompoundTag save(CompoundTag tag) {
        tag.putBoolean("enabled", enabled);
        tag.putInt("x1", x1); tag.putInt("y1", y1); tag.putInt("z1", z1);
        tag.putInt("x2", x2); tag.putInt("y2", y2); tag.putInt("z2", z2);
        return tag;
    }

    public static SpawnProtection load(CompoundTag tag) {
        SpawnProtection d = new SpawnProtection();
        d.enabled = tag.getBoolean("enabled");
        d.x1 = tag.getInt("x1"); d.y1 = tag.getInt("y1"); d.z1 = tag.getInt("z1");
        d.x2 = tag.getInt("x2"); d.y2 = tag.getInt("y2"); d.z2 = tag.getInt("z2");
        return d;
    }
}
