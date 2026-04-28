package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.data.PlayerHomes;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

public final class HomeCommand {
    private HomeCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("sethome")
                .requires(s -> Permissions.has(s, Permissions.HOME))
                .then(Commands.argument("name", StringArgumentType.word())
                        .executes(ctx -> setHome(ctx.getSource().getPlayerOrException(),
                                StringArgumentType.getString(ctx, "name")))));

        dispatcher.register(Commands.literal("home")
                .requires(s -> Permissions.has(s, Permissions.HOME))
                .then(Commands.argument("name", StringArgumentType.word())
                        .executes(ctx -> goHome(ctx.getSource().getPlayerOrException(),
                                StringArgumentType.getString(ctx, "name")))));

        dispatcher.register(Commands.literal("delhome")
                .requires(s -> Permissions.has(s, Permissions.HOME))
                .then(Commands.argument("name", StringArgumentType.word())
                        .executes(ctx -> delHome(ctx.getSource().getPlayerOrException(),
                                StringArgumentType.getString(ctx, "name")))));

        dispatcher.register(Commands.literal("homes")
                .requires(s -> Permissions.has(s, Permissions.HOME))
                .executes(ctx -> listHomes(ctx.getSource().getPlayerOrException())));
    }

    private static int setHome(ServerPlayer p, String name) {
        ServerLevel sl = p.serverLevel();
        PlayerHomes.set(p, name, new PlayerHomes.Home(
                sl.dimension(), p.getX(), p.getY(), p.getZ(), p.getYRot(), p.getXRot()));
        p.sendSystemMessage(Component.literal("Home '" + name + "' set."));
        return 1;
    }

    private static int goHome(ServerPlayer p, String name) {
        PlayerHomes.Home h = PlayerHomes.get(p, name);
        if (h == null) {
            p.sendSystemMessage(Component.literal("No home named '" + name + "'."));
            return 0;
        }
        ServerLevel level = p.getServer().getLevel(h.dim());
        if (level == null) {
            p.sendSystemMessage(Component.literal("Home dimension not loaded."));
            return 0;
        }
        p.teleportTo(level, h.x(), h.y(), h.z(), h.yaw(), h.pitch());
        p.sendSystemMessage(Component.literal("Teleported to home '" + name + "'."));
        return 1;
    }

    private static int delHome(ServerPlayer p, String name) {
        boolean ok = PlayerHomes.remove(p, name);
        p.sendSystemMessage(Component.literal(ok ? "Home '" + name + "' deleted." : "No such home."));
        return ok ? 1 : 0;
    }

    private static int listHomes(ServerPlayer p) {
        var names = PlayerHomes.names(p);
        if (names.isEmpty()) {
            p.sendSystemMessage(Component.literal("You have no homes."));
        } else {
            p.sendSystemMessage(Component.literal("Homes: " + String.join(", ", names)));
        }
        return 1;
    }
}
