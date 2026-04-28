package com.cgrodsky.adminessentials.state;

import com.cgrodsky.adminessentials.Permissions;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.server.ServerStartedEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.server.permission.nodes.PermissionNode;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class RoleManager {
    public static final Map<String, Set<PermissionNode<Boolean>>> ROLES = new LinkedHashMap<>();
    private static final Map<UUID, Grant> GRANTS = new HashMap<>();
    private static MinecraftServer server;

    public record Grant(String role, long expiresAtMs) {
        public boolean isExpired() {
            return expiresAtMs > 0 && System.currentTimeMillis() >= expiresAtMs;
        }
    }

    static {
        ROLES.put("admin", Set.of(
                Permissions.SUDO, Permissions.ADMIN_CHAT, Permissions.XRAY_ALERTS,
                Permissions.VANISH, Permissions.XRAY, Permissions.ATP,
                Permissions.HEAL, Permissions.FEED, Permissions.GOD, Permissions.FLY, Permissions.SPEED,
                Permissions.HOME, Permissions.WARP, Permissions.WARP_SET, Permissions.BACK,
                Permissions.MORPH, Permissions.SPAWN, Permissions.SPAWN_SET, Permissions.PROTECTION_BYPASS
        ));
        ROLES.put("moderator", Set.of(
                Permissions.SUDO, Permissions.ADMIN_CHAT, Permissions.XRAY_ALERTS,
                Permissions.VANISH, Permissions.XRAY, Permissions.ATP,
                Permissions.HEAL, Permissions.FEED, Permissions.GOD, Permissions.FLY,
                Permissions.HOME, Permissions.WARP, Permissions.BACK,
                Permissions.PROTECTION_BYPASS
        ));
        ROLES.put("helper", Set.of(
                Permissions.ADMIN_CHAT, Permissions.VANISH, Permissions.ATP,
                Permissions.HOME, Permissions.WARP, Permissions.BACK
        ));
    }

    public RoleManager() {}

    public static boolean has(UUID uuid, PermissionNode<Boolean> node) {
        Grant g = GRANTS.get(uuid);
        if (g == null || g.isExpired()) return false;
        Set<PermissionNode<Boolean>> nodes = ROLES.get(g.role);
        if (nodes == null) return false;
        return nodes.contains(node);
    }

    public static Grant grant(UUID uuid, String role, long durationMs) {
        if (!ROLES.containsKey(role)) return null;
        long expiresAt = durationMs > 0 ? System.currentTimeMillis() + durationMs : -1;
        Grant g = new Grant(role, expiresAt);
        GRANTS.put(uuid, g);
        return g;
    }

    public static Grant revoke(UUID uuid) {
        return GRANTS.remove(uuid);
    }

    public static Grant get(UUID uuid) {
        Grant g = GRANTS.get(uuid);
        if (g == null) return null;
        if (g.isExpired()) {
            GRANTS.remove(uuid);
            return null;
        }
        return g;
    }

    public static long parseDuration(String s) {
        if (s == null || s.isEmpty()) return 0;
        char unit = s.charAt(s.length() - 1);
        String numPart = s.substring(0, s.length() - 1);
        long n;
        try { n = Long.parseLong(numPart); } catch (NumberFormatException e) { return -1; }
        return switch (unit) {
            case 's' -> n * 1000L;
            case 'm' -> n * 60_000L;
            case 'h' -> n * 3_600_000L;
            case 'd' -> n * 86_400_000L;
            default -> -1;
        };
    }

    @SubscribeEvent
    public void onServerStarted(ServerStartedEvent e) {
        server = e.getServer();
    }

    @SubscribeEvent
    public void onTick(TickEvent.ServerTickEvent e) {
        if (e.phase != TickEvent.Phase.END) return;
        if (server == null) return;
        if (server.getTickCount() % 20 != 0) return;
        GRANTS.entrySet().removeIf(entry -> {
            if (!entry.getValue().isExpired()) return false;
            ServerPlayer p = server.getPlayerList().getPlayer(entry.getKey());
            if (p != null) {
                p.sendSystemMessage(net.minecraft.network.chat.Component.literal(
                        "Your role '" + entry.getValue().role + "' has expired."));
            }
            return true;
        });
    }
}
