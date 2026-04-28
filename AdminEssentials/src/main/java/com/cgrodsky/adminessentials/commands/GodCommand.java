package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.state.GodTracker;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public final class GodCommand {
    private GodCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("god")
                .requires(s -> Permissions.has(s, Permissions.GOD))
                .executes(ctx -> toggle(ctx.getSource().getPlayerOrException()))
                .then(Commands.argument("target", EntityArgument.player())
                        .executes(ctx -> toggle(EntityArgument.getPlayer(ctx, "target")))));
    }

    private static int toggle(ServerPlayer p) {
        boolean now = GodTracker.toggle(p.getUUID());
        p.sendSystemMessage(Component.literal("God mode " + (now ? "enabled." : "disabled.")));
        return 1;
    }
}
