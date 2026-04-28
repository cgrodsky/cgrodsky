package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.server.level.ServerPlayer;

public final class SudoCommand {
    private SudoCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("sudo")
                .requires(src -> Permissions.has(src, Permissions.SUDO))
                .then(Commands.argument("target", EntityArgument.player())
                        .then(Commands.argument("command", StringArgumentType.greedyString())
                                .executes(ctx -> {
                                    ServerPlayer target = EntityArgument.getPlayer(ctx, "target");
                                    String command = StringArgumentType.getString(ctx, "command");
                                    ctx.getSource().getServer().getCommands()
                                            .performPrefixedCommand(target.createCommandSourceStack(), command);
                                    return 1;
                                }))));
    }
}
