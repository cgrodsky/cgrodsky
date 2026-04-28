package com.cgrodsky.adminessentials.alerts;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.Block;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class AlertCooldown {
    private static final long WINDOW_MS = 30_000L;
    private static final int RADIUS = 6;

    private record Key(UUID player, Block block) {}
    private record Entry(BlockPos pos, long timestamp) {}

    private static final Map<Key, Entry> LAST = new HashMap<>();

    public static synchronized boolean shouldSuppress(UUID player, Block block, BlockPos pos) {
        Key key = new Key(player, block);
        long now = System.currentTimeMillis();
        Entry prev = LAST.get(key);
        LAST.put(key, new Entry(pos.immutable(), now));

        if (prev == null) return false;
        if (now - prev.timestamp > WINDOW_MS) return false;
        return manhattan(prev.pos, pos) <= RADIUS;
    }

    private static int manhattan(BlockPos a, BlockPos b) {
        return Math.abs(a.getX() - b.getX()) + Math.abs(a.getY() - b.getY()) + Math.abs(a.getZ() - b.getZ());
    }

    private AlertCooldown() {}
}
