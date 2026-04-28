package com.cgrodsky.adminessentials.events;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.data.SpawnProtection;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.event.level.BlockEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

public class ProtectionListener {
    @SubscribeEvent
    public void onBreak(BlockEvent.BreakEvent e) {
        if (!(e.getLevel() instanceof ServerLevel sl)) return;
        SpawnProtection sp = SpawnProtection.get(sl);
        if (!sp.contains(e.getPos())) return;
        if (e.getPlayer() instanceof ServerPlayer p && Permissions.has(p, Permissions.PROTECTION_BYPASS)) return;
        e.setCanceled(true);
        if (e.getPlayer() instanceof ServerPlayer p) {
            p.sendSystemMessage(Component.literal("This area is protected.")
                    .withStyle(ChatFormatting.RED));
        }
    }

    @SubscribeEvent
    public void onPlace(BlockEvent.EntityPlaceEvent e) {
        if (!(e.getLevel() instanceof ServerLevel sl)) return;
        SpawnProtection sp = SpawnProtection.get(sl);
        if (!sp.contains(e.getPos())) return;
        if (e.getEntity() instanceof ServerPlayer p && Permissions.has(p, Permissions.PROTECTION_BYPASS)) return;
        e.setCanceled(true);
        if (e.getEntity() instanceof ServerPlayer p) {
            p.sendSystemMessage(Component.literal("This area is protected.")
                    .withStyle(ChatFormatting.RED));
        }
    }
}
