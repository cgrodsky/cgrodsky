package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.state.MorphManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.EntityType;

import java.util.Optional;

public final class MorphCommand {
    private MorphCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("morph")
                .requires(s -> Permissions.has(s, Permissions.MORPH))
                .then(Commands.argument("entity", StringArgumentType.word())
                        .executes(ctx -> morph(ctx.getSource().getPlayerOrException(),
                                StringArgumentType.getString(ctx, "entity")))));

        dispatcher.register(Commands.literal("unmorph")
                .requires(s -> Permissions.has(s, Permissions.MORPH))
                .executes(ctx -> unmorph(ctx.getSource().getPlayerOrException())));
    }

    private static int morph(ServerPlayer p, String name) {
        ResourceLocation rl = name.contains(":") ? new ResourceLocation(name) : new ResourceLocation("minecraft", name);
        Optional<EntityType<?>> opt = BuiltInRegistries.ENTITY_TYPE.getOptional(rl);
        if (opt.isEmpty()) {
            p.sendSystemMessage(Component.literal("Unknown entity type: " + name));
            return 0;
        }
        if (!MorphManager.morph(p, opt.get())) {
            p.sendSystemMessage(Component.literal("Could not morph (already morphed or entity could not spawn)."));
            return 0;
        }
        p.sendSystemMessage(Component.literal("You are now morphed. Ops see [M] before your name."));
        return 1;
    }

    private static int unmorph(ServerPlayer p) {
        if (!MorphManager.unmorph(p)) {
            p.sendSystemMessage(Component.literal("You are not morphed."));
            return 0;
        }
        p.sendSystemMessage(Component.literal("You are no longer morphed."));
        return 1;
    }
}
