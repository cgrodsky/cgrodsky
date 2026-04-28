package com.cgrodsky.adminessentials.alerts;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.Block;
import net.minecraftforge.event.level.BlockEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

public class XrayAlertListener {
    @SubscribeEvent
    public void onBreak(BlockEvent.BreakEvent event) {
        if (!(event.getPlayer() instanceof ServerPlayer player)) return;
        Block block = event.getState().getBlock();
        if (!WatchedOres.DEFAULT.contains(block)) return;
        if (AlertCooldown.shouldSuppress(player.getUUID(), block, event.getPos())) return;

        String name = player.getName().getString();
        String dim = player.level().dimension().location().toString();
        Component msg = Component.literal("[X-Ray] ").withStyle(ChatFormatting.GOLD)
                .append(Component.literal(name + " mined ").withStyle(ChatFormatting.YELLOW))
                .append(block.getName().copy().withStyle(ChatFormatting.AQUA))
                .append(Component.literal(" at " + event.getPos().toShortString() + " (" + dim + ")")
                        .withStyle(ChatFormatting.GRAY));

        MinecraftServer server = player.getServer();
        if (server == null) return;
        server.sendSystemMessage(msg);
        for (ServerPlayer op : server.getPlayerList().getPlayers()) {
            if (server.getPlayerList().isOp(op.getGameProfile())) {
                op.sendSystemMessage(msg);
            }
        }
    }
}
