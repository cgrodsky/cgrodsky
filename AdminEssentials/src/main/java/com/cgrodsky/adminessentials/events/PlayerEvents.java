package com.cgrodsky.adminessentials.events;

import com.cgrodsky.adminessentials.state.BackTracker;
import com.cgrodsky.adminessentials.state.MorphManager;
import com.cgrodsky.adminessentials.state.TeamManager;
import com.cgrodsky.adminessentials.state.VanishManager;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraftforge.event.entity.EntityTeleportEvent;
import net.minecraftforge.event.entity.living.LivingDeathEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.server.ServerStartedEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

public class PlayerEvents {
    @SubscribeEvent
    public void onServerStarted(ServerStartedEvent e) {
        TeamManager.ensureTeams(e.getServer());
    }

    @SubscribeEvent
    public void onLogin(PlayerEvent.PlayerLoggedInEvent e) {
        if (!(e.getEntity() instanceof ServerPlayer p)) return;
        VanishManager.onJoin(p);
        MorphManager.onJoin(p);
    }

    @SubscribeEvent
    public void onDeath(LivingDeathEvent e) {
        if (!(e.getEntity() instanceof ServerPlayer p)) return;
        if (p.level() instanceof ServerLevel sl) {
            BackTracker.record(p.getUUID(), sl, p.getX(), p.getY(), p.getZ(), p.getYRot(), p.getXRot());
        }
    }

    @SubscribeEvent
    public void onTeleport(EntityTeleportEvent e) {
        Entity ent = e.getEntity();
        if (!(ent instanceof ServerPlayer p)) return;
        if (p.level() instanceof ServerLevel sl) {
            BackTracker.record(p.getUUID(), sl, p.getX(), p.getY(), p.getZ(), p.getYRot(), p.getXRot());
        }
    }
}
