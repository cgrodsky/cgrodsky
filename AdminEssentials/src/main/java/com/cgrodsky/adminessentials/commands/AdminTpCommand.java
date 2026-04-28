package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.state.VanishManager;
import com.cgrodsky.adminessentials.state.XrayStateTracker;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

public final class AdminTpCommand {
    private AdminTpCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("atp")
                .requires(s -> Permissions.has(s, Permissions.ATP))
                .then(Commands.argument("target", EntityArgument.player())
                        .executes(ctx -> tp(ctx.getSource().getPlayerOrException(),
                                EntityArgument.getPlayer(ctx, "target"), false))
                        .then(Commands.literal("stealth")
                                .executes(ctx -> tp(ctx.getSource().getPlayerOrException(),
                                        EntityArgument.getPlayer(ctx, "target"), true)))));
    }

    private static int tp(ServerPlayer self, ServerPlayer target, boolean stealth) {
        ServerLevel destLevel = target.serverLevel();
        self.teleportTo(destLevel, target.getX(), target.getY(), target.getZ(), target.getYRot(), target.getXRot());
        if (stealth) {
            VanishManager.setVanished(self, true);
            XrayStateTracker.enable(self);
            self.sendSystemMessage(Component.literal("Stealth-tp engaged: vanished + spectator."));
        } else {
            self.sendSystemMessage(Component.literal("Teleported to " + target.getName().getString() + "."));
        }
        return 1;
    }
}
