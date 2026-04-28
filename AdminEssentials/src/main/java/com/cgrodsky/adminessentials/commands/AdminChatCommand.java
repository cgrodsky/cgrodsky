package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

public final class AdminChatCommand {
    private AdminChatCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("a")
                .requires(src -> Permissions.has(src, Permissions.ADMIN_CHAT))
                .then(Commands.argument("message", StringArgumentType.greedyString())
                        .executes(ctx -> {
                            CommandSourceStack source = ctx.getSource();
                            String message = StringArgumentType.getString(ctx, "message");
                            String senderName = source.getTextName();

                            Component out = Component.literal("[A] ").withStyle(ChatFormatting.LIGHT_PURPLE)
                                    .append(Component.literal(senderName + ": ").withStyle(ChatFormatting.WHITE))
                                    .append(Component.literal(message).withStyle(ChatFormatting.GRAY));

                            MinecraftServer server = source.getServer();
                            server.sendSystemMessage(out);
                            for (ServerPlayer p : server.getPlayerList().getPlayers()) {
                                if (server.getPlayerList().isOp(p.getGameProfile())) {
                                    p.sendSystemMessage(out);
                                }
                            }
                            return 1;
                        })));
    }
}
