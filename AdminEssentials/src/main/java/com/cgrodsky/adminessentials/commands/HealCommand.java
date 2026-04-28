package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public final class HealCommand {
    private HealCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("heal")
                .requires(s -> Permissions.has(s, Permissions.HEAL))
                .executes(ctx -> heal(ctx.getSource().getPlayerOrException()))
                .then(Commands.argument("target", EntityArgument.player())
                        .executes(ctx -> heal(EntityArgument.getPlayer(ctx, "target")))));
    }

    private static int heal(ServerPlayer p) {
        p.setHealth(p.getMaxHealth());
        p.sendSystemMessage(Component.literal("You have been healed."));
        return 1;
    }
}
