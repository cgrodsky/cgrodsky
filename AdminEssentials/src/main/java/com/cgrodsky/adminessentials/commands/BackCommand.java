package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.state.BackTracker;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

public final class BackCommand {
    private BackCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("back")
                .requires(s -> Permissions.has(s, Permissions.BACK))
                .executes(ctx -> back(ctx.getSource().getPlayerOrException())));
    }

    private static int back(ServerPlayer p) {
        BackTracker.Pos pos = BackTracker.consume(p.getUUID());
        if (pos == null) {
            p.sendSystemMessage(Component.literal("No previous location recorded."));
            return 0;
        }
        ServerLevel level = p.getServer().getLevel(pos.dim());
        if (level == null) {
            p.sendSystemMessage(Component.literal("Previous location dimension not loaded."));
            return 0;
        }
        if (p.level() instanceof ServerLevel current) {
            BackTracker.record(p.getUUID(), current, p.getX(), p.getY(), p.getZ(), p.getYRot(), p.getXRot());
        }
        p.teleportTo(level, pos.x(), pos.y(), pos.z(), pos.yaw(), pos.pitch());
        p.sendSystemMessage(Component.literal("Returned to previous location."));
        return 1;
    }
}
