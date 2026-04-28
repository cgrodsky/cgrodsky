package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.data.WarpData;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

public final class WarpCommand {
    private WarpCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("setwarp")
                .requires(s -> Permissions.has(s, Permissions.WARP_SET))
                .then(Commands.argument("name", StringArgumentType.word())
                        .executes(ctx -> setWarp(ctx.getSource().getPlayerOrException(),
                                StringArgumentType.getString(ctx, "name")))));

        dispatcher.register(Commands.literal("warp")
                .requires(s -> Permissions.has(s, Permissions.WARP))
                .then(Commands.argument("name", StringArgumentType.word())
                        .executes(ctx -> warp(ctx.getSource().getPlayerOrException(),
                                StringArgumentType.getString(ctx, "name")))));

        dispatcher.register(Commands.literal("delwarp")
                .requires(s -> Permissions.has(s, Permissions.WARP_SET))
                .then(Commands.argument("name", StringArgumentType.word())
                        .executes(ctx -> delWarp(ctx.getSource().getPlayerOrException(),
                                StringArgumentType.getString(ctx, "name")))));

        dispatcher.register(Commands.literal("warps")
                .requires(s -> Permissions.has(s, Permissions.WARP))
                .executes(ctx -> listWarps(ctx.getSource().getPlayerOrException())));
    }

    private static int setWarp(ServerPlayer p, String name) {
        ServerLevel sl = p.serverLevel();
        WarpData.get(sl).set(name, new WarpData.Warp(
                sl.dimension(), p.getX(), p.getY(), p.getZ(), p.getYRot(), p.getXRot()));
        p.sendSystemMessage(Component.literal("Warp '" + name + "' set."));
        return 1;
    }

    private static int warp(ServerPlayer p, String name) {
        WarpData.Warp w = WarpData.get(p.serverLevel()).get(name);
        if (w == null) {
            p.sendSystemMessage(Component.literal("No warp named '" + name + "'."));
            return 0;
        }
        ServerLevel level = p.getServer().getLevel(w.dim());
        if (level == null) {
            p.sendSystemMessage(Component.literal("Warp dimension not loaded."));
            return 0;
        }
        p.teleportTo(level, w.x(), w.y(), w.z(), w.yaw(), w.pitch());
        p.sendSystemMessage(Component.literal("Teleported to warp '" + name + "'."));
        return 1;
    }

    private static int delWarp(ServerPlayer p, String name) {
        boolean ok = WarpData.get(p.serverLevel()).remove(name);
        p.sendSystemMessage(Component.literal(ok ? "Warp '" + name + "' deleted." : "No such warp."));
        return ok ? 1 : 0;
    }

    private static int listWarps(ServerPlayer p) {
        var names = WarpData.get(p.serverLevel()).names();
        if (names.isEmpty()) {
            p.sendSystemMessage(Component.literal("No warps defined."));
        } else {
            p.sendSystemMessage(Component.literal("Warps: " + String.join(", ", names)));
        }
        return 1;
    }
}
