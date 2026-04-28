package com.cgrodsky.adminessentials.visibility;

import net.minecraft.network.protocol.game.ClientboundAddEntityPacket;
import net.minecraft.network.protocol.game.ClientboundRemoveEntitiesPacket;
import net.minecraft.network.protocol.game.ClientboundSetEntityDataPacket;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;

import java.util.List;
import java.util.function.Predicate;

public final class EntityVisibility {
    private EntityVisibility() {}

    public static void hideFrom(Entity entity, ServerPlayer viewer) {
        viewer.connection.send(new ClientboundRemoveEntitiesPacket(entity.getId()));
    }

    public static void showTo(Entity entity, ServerPlayer viewer) {
        viewer.connection.send(new ClientboundAddEntityPacket(entity));
        SynchedEntityData data = entity.getEntityData();
        List<SynchedEntityData.DataValue<?>> values = data.getNonDefaultValues();
        if (values != null) {
            viewer.connection.send(new ClientboundSetEntityDataPacket(entity.getId(), values));
        }
    }

    public static void hideFromMatching(Entity entity, MinecraftServer server, Predicate<ServerPlayer> filter) {
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            if (p.getUUID().equals(entity.getUUID())) continue;
            if (filter.test(p)) hideFrom(entity, p);
        }
    }

    public static void showToMatching(Entity entity, MinecraftServer server, Predicate<ServerPlayer> filter) {
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            if (p.getUUID().equals(entity.getUUID())) continue;
            if (filter.test(p)) showTo(entity, p);
        }
    }
}
