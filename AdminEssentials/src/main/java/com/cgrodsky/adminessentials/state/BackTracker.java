package com.cgrodsky.adminessentials.state;

import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class BackTracker {
    public record Pos(ResourceKey<Level> dim, double x, double y, double z, float yaw, float pitch) {}

    private static final Map<UUID, Pos> LAST = new HashMap<>();

    private BackTracker() {}

    public static void record(UUID uuid, ServerLevel level, double x, double y, double z, float yaw, float pitch) {
        LAST.put(uuid, new Pos(level.dimension(), x, y, z, yaw, pitch));
    }

    public static Pos consume(UUID uuid) {
        return LAST.remove(uuid);
    }
}
