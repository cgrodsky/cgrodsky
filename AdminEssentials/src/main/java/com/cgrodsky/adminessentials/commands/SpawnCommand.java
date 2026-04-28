package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.data.SpawnProtection;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

public final class SpawnCommand {
    private SpawnCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("spawn")
                .requires(s -> Permissions.has(s, Permissions.SPAWN))
                .executes(ctx -> goSpawn(ctx.getSource().getPlayerOrException())));

        dispatcher.register(Commands.literal("spawnw")
                .requires(s -> Permissions.has(s, Permissions.SPAWN_SET))
                .then(Commands.argument("x1", IntegerArgumentType.integer())
                        .then(Commands.argument("y1", IntegerArgumentType.integer())
                                .then(Commands.argument("z1", IntegerArgumentType.integer())
                                        .then(Commands.argument("x2", IntegerArgumentType.integer())
                                                .then(Commands.argument("y2", IntegerArgumentType.integer())
                                                        .then(Commands.argument("z2", IntegerArgumentType.integer())
                                                                .executes(SpawnCommand::setRegion))))))));

        dispatcher.register(Commands.literal("spawnwclear")
                .requires(s -> Permissions.has(s, Permissions.SPAWN_SET))
                .executes(ctx -> {
                    ServerPlayer p = ctx.getSource().getPlayerOrException();
                    SpawnProtection.get(p.serverLevel()).clear();
                    p.sendSystemMessage(Component.literal("Spawn protection cleared."));
                    return 1;
                }));
    }

    private static int goSpawn(ServerPlayer p) {
        ServerLevel overworld = p.getServer().overworld();
        BlockPos s = overworld.getSharedSpawnPos();
        p.teleportTo(overworld, s.getX() + 0.5, s.getY(), s.getZ() + 0.5, 0f, 0f);
        p.sendSystemMessage(Component.literal("Teleported to world spawn."));
        return 1;
    }

    private static int setRegion(com.mojang.brigadier.context.CommandContext<CommandSourceStack> ctx)
            throws com.mojang.brigadier.exceptions.CommandSyntaxException {
        ServerPlayer p = ctx.getSource().getPlayerOrException();
        BlockPos a = new BlockPos(
                IntegerArgumentType.getInteger(ctx, "x1"),
                IntegerArgumentType.getInteger(ctx, "y1"),
                IntegerArgumentType.getInteger(ctx, "z1"));
        BlockPos b = new BlockPos(
                IntegerArgumentType.getInteger(ctx, "x2"),
                IntegerArgumentType.getInteger(ctx, "y2"),
                IntegerArgumentType.getInteger(ctx, "z2"));
        SpawnProtection sp = SpawnProtection.get(p.serverLevel());
        sp.set(a, b);
        p.sendSystemMessage(Component.literal("Spawn protection set: " + sp.describe()));
        return 1;
    }
}
