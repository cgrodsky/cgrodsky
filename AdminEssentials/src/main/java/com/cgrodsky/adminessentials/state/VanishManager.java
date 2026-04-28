package com.cgrodsky.adminessentials.state;

import com.cgrodsky.adminessentials.visibility.EntityVisibility;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public final class VanishManager {
    private static final Set<UUID> VANISHED = new HashSet<>();

    private VanishManager() {}

    public static boolean isVanished(UUID uuid) {
        return VANISHED.contains(uuid);
    }

    public static void setVanished(ServerPlayer player, boolean vanished) {
        MinecraftServer server = player.getServer();
        if (server == null) return;
        TeamManager.ensureTeams(server);

        if (vanished) {
            VANISHED.add(player.getUUID());
            TeamManager.addToTeam(server, TeamManager.VANISH_TEAM, player.getGameProfile().getName());
            EntityVisibility.hideFromMatching(player, server, viewer -> !isOp(server, viewer));
        } else {
            VANISHED.remove(player.getUUID());
            TeamManager.removeFromTeam(server, TeamManager.VANISH_TEAM, player.getGameProfile().getName());
            EntityVisibility.showToMatching(player, server, viewer -> !isOp(server, viewer));
        }
    }

    public static void onJoin(ServerPlayer joiner) {
        MinecraftServer server = joiner.getServer();
        if (server == null) return;
        for (ServerPlayer other : server.getPlayerList().getPlayers()) {
            if (other.getUUID().equals(joiner.getUUID())) continue;
            if (VANISHED.contains(other.getUUID()) && !isOp(server, joiner)) {
                EntityVisibility.hideFrom(other, joiner);
            }
        }
    }

    private static boolean isOp(MinecraftServer server, ServerPlayer p) {
        return server.getPlayerList().isOp(p.getGameProfile());
    }
}
