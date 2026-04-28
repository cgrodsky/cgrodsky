package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.state.VanishManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public final class VanishCommand {
    private VanishCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("vanish")
                .requires(s -> Permissions.has(s, Permissions.VANISH))
                .executes(ctx -> toggle(ctx.getSource().getPlayerOrException()))
                .then(Commands.argument("target", EntityArgument.player())
                        .executes(ctx -> toggle(EntityArgument.getPlayer(ctx, "target")))));
    }

    private static int toggle(ServerPlayer p) {
        boolean nowVanished = !VanishManager.isVanished(p.getUUID());
        VanishManager.setVanished(p, nowVanished);
        p.sendSystemMessage(Component.literal(nowVanished
                ? "You are now vanished. Ops see [V] before your name."
                : "You are no longer vanished."));
        return 1;
    }
}
