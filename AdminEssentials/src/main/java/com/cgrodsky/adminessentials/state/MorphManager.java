package com.cgrodsky.adminessentials.state;

import com.cgrodsky.adminessentials.visibility.EntityVisibility;
import net.minecraft.network.protocol.game.ClientboundTeleportEntityPacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.server.ServerStartedEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class MorphManager {
    private static final Map<UUID, Entity> ACTIVE = new HashMap<>();
    private static MinecraftServer server;

    public MorphManager() {}

    public static boolean isMorphed(UUID uuid) { return ACTIVE.containsKey(uuid); }

    public static boolean morph(ServerPlayer player, EntityType<?> type) {
        if (ACTIVE.containsKey(player.getUUID())) return false;
        MinecraftServer srv = player.getServer();
        if (srv == null) return false;
        TeamManager.ensureTeams(srv);

        Entity entity = type.create(player.serverLevel());
        if (entity == null) return false;
        entity.moveTo(player.getX(), player.getY(), player.getZ(), player.getYRot(), player.getXRot());
        entity.setInvulnerable(true);
        if (entity instanceof Mob m) {
            m.setNoAi(true);
            m.setPersistenceRequired();
        }
        entity.setSilent(true);
        player.serverLevel().addFreshEntity(entity);

        ACTIVE.put(player.getUUID(), entity);
        TeamManager.addToTeam(srv, TeamManager.MORPH_TEAM, player.getGameProfile().getName());
        EntityVisibility.hideFromMatching(player, srv, viewer -> !isOp(srv, viewer));
        EntityVisibility.hideFromMatching(entity, srv, viewer -> isOp(srv, viewer));
        return true;
    }

    public static boolean unmorph(ServerPlayer player) {
        Entity ent = ACTIVE.remove(player.getUUID());
        if (ent == null) return false;
        MinecraftServer srv = player.getServer();
        if (srv == null) return false;

        ent.discard();
        TeamManager.removeFromTeam(srv, TeamManager.MORPH_TEAM, player.getGameProfile().getName());
        EntityVisibility.showToMatching(player, srv, viewer -> !isOp(srv, viewer));
        return true;
    }

    public static void onJoin(ServerPlayer joiner) {
        MinecraftServer srv = joiner.getServer();
        if (srv == null) return;
        boolean joinerIsOp = isOp(srv, joiner);
        for (Map.Entry<UUID, Entity> e : ACTIVE.entrySet()) {
            ServerPlayer morphed = srv.getPlayerList().getPlayer(e.getKey());
            if (morphed == null) continue;
            if (joinerIsOp) {
                EntityVisibility.hideFrom(e.getValue(), joiner);
            } else {
                EntityVisibility.hideFrom(morphed, joiner);
            }
        }
    }

    @SubscribeEvent
    public void onServerStarted(ServerStartedEvent e) { server = e.getServer(); }

    @SubscribeEvent
    public void onTick(TickEvent.ServerTickEvent e) {
        if (e.phase != TickEvent.Phase.END) return;
        if (server == null || ACTIVE.isEmpty()) return;
        for (Map.Entry<UUID, Entity> entry : ACTIVE.entrySet()) {
            ServerPlayer p = server.getPlayerList().getPlayer(entry.getKey());
            Entity ent = entry.getValue();
            if (p == null || !ent.isAlive()) continue;
            ent.moveTo(p.getX(), p.getY(), p.getZ(), p.getYRot(), p.getXRot());
            ent.setYHeadRot(p.getYHeadRot());
            ClientboundTeleportEntityPacket pkt = new ClientboundTeleportEntityPacket(ent);
            for (ServerPlayer viewer : server.getPlayerList().getPlayers()) {
                if (viewer.getUUID().equals(p.getUUID())) continue;
                if (!isOp(server, viewer)) viewer.connection.send(pkt);
            }
        }
    }

    private static boolean isOp(MinecraftServer srv, ServerPlayer p) {
        return srv.getPlayerList().isOp(p.getGameProfile());
    }
}
