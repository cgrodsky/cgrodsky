package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.FloatArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public final class SpeedCommand {
    private SpeedCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("speed")
                .requires(s -> Permissions.has(s, Permissions.SPEED))
                .then(Commands.argument("multiplier", FloatArgumentType.floatArg(0f, 10f))
                        .executes(ctx -> set(ctx.getSource().getPlayerOrException(),
                                FloatArgumentType.getFloat(ctx, "multiplier")))
                        .then(Commands.argument("target", EntityArgument.player())
                                .executes(ctx -> set(EntityArgument.getPlayer(ctx, "target"),
                                        FloatArgumentType.getFloat(ctx, "multiplier"))))));
    }

    private static int set(ServerPlayer p, float mult) {
        float walk = 0.1f * mult;
        float fly  = 0.05f * mult;
        p.getAbilities().setWalkingSpeed(walk);
        p.getAbilities().setFlyingSpeed(fly);
        p.onUpdateAbilities();
        p.sendSystemMessage(Component.literal("Speed set to " + mult + "x."));
        return 1;
    }
}
