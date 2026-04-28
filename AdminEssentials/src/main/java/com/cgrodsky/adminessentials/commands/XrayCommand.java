package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.state.XrayStateTracker;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public final class XrayCommand {
    private XrayCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("xray")
                .requires(s -> Permissions.has(s, Permissions.XRAY))
                .then(Commands.literal("on").executes(ctx -> enable(ctx.getSource().getPlayerOrException())))
                .then(Commands.literal("off").executes(ctx -> disable(ctx.getSource().getPlayerOrException())))
                .executes(ctx -> {
                    ServerPlayer p = ctx.getSource().getPlayerOrException();
                    return XrayStateTracker.isActive(p.getUUID()) ? disable(p) : enable(p);
                }));
    }

    private static int enable(ServerPlayer p) {
        XrayStateTracker.enable(p);
        p.sendSystemMessage(Component.literal("X-ray vision enabled (spectator mode)."));
        return 1;
    }

    private static int disable(ServerPlayer p) {
        if (XrayStateTracker.disable(p) == null) {
            p.sendSystemMessage(Component.literal("X-ray was not enabled."));
            return 0;
        }
        p.sendSystemMessage(Component.literal("X-ray vision disabled."));
        return 1;
    }
}
