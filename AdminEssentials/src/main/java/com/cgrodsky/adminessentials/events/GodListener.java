package com.cgrodsky.adminessentials.events;

import com.cgrodsky.adminessentials.state.GodTracker;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.event.entity.living.LivingAttackEvent;
import net.minecraftforge.event.entity.living.LivingHurtEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

public class GodListener {
    @SubscribeEvent
    public void onAttack(LivingAttackEvent e) {
        if (e.getEntity() instanceof ServerPlayer p && GodTracker.isGod(p.getUUID())) {
            e.setCanceled(true);
        }
    }

    @SubscribeEvent
    public void onHurt(LivingHurtEvent e) {
        if (e.getEntity() instanceof ServerPlayer p && GodTracker.isGod(p.getUUID())) {
            e.setCanceled(true);
        }
    }
}
