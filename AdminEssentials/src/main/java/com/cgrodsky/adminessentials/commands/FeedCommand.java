package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public final class FeedCommand {
    private FeedCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("feed")
                .requires(s -> Permissions.has(s, Permissions.FEED))
                .executes(ctx -> feed(ctx.getSource().getPlayerOrException()))
                .then(Commands.argument("target", EntityArgument.player())
                        .executes(ctx -> feed(EntityArgument.getPlayer(ctx, "target")))));
    }

    private static int feed(ServerPlayer p) {
        p.getFoodData().setFoodLevel(20);
        p.getFoodData().setSaturation(20f);
        p.sendSystemMessage(Component.literal("You have been fed."));
        return 1;
    }
}
