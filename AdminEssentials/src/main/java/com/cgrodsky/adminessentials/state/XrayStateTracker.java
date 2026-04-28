package com.cgrodsky.adminessentials.state;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.GameType;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class XrayStateTracker {
    public record SavedState(GameType mode, ServerLevel level, double x, double y, double z, float yaw, float pitch) {}

    private static final Map<UUID, SavedState> SAVED = new HashMap<>();

    private XrayStateTracker() {}

    public static boolean isActive(UUID uuid) { return SAVED.containsKey(uuid); }

    public static void enable(ServerPlayer p) {
        if (SAVED.containsKey(p.getUUID())) return;
        SAVED.put(p.getUUID(), new SavedState(
                p.gameMode.getGameModeForPlayer(),
                p.serverLevel(),
                p.getX(), p.getY(), p.getZ(),
                p.getYRot(), p.getXRot()
        ));
        p.setGameMode(GameType.SPECTATOR);
    }

    public static SavedState disable(ServerPlayer p) {
        SavedState s = SAVED.remove(p.getUUID());
        if (s == null) return null;
        p.setGameMode(s.mode());
        p.teleportTo(s.level(), s.x(), s.y(), s.z(), s.yaw(), s.pitch());
        return s;
    }
}
