package com.cgrodsky.adminessentials.commands;

import com.cgrodsky.adminessentials.Permissions;
import com.cgrodsky.adminessentials.state.RoleManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.suggestion.SuggestionProvider;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public final class RoleCommand {
    private RoleCommand() {}

    private static final SuggestionProvider<CommandSourceStack> ROLE_NAMES = (ctx, builder) -> {
        for (String name : RoleManager.ROLES.keySet()) builder.suggest(name);
        return builder.buildFuture();
    };

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("role")
                .requires(s -> Permissions.has(s, Permissions.ROLE))
                .executes(RoleCommand::list)
                .then(Commands.literal("list").executes(RoleCommand::list))
                .then(Commands.argument("target", EntityArgument.player())
                        .executes(ctx -> show(ctx.getSource(), EntityArgument.getPlayer(ctx, "target")))
                        .then(Commands.literal("remove")
                                .executes(ctx -> revoke(ctx.getSource(), EntityArgument.getPlayer(ctx, "target"))))
                        .then(Commands.argument("role", StringArgumentType.word())
                                .suggests(ROLE_NAMES)
                                .executes(ctx -> assign(ctx.getSource(),
                                        EntityArgument.getPlayer(ctx, "target"),
                                        StringArgumentType.getString(ctx, "role"),
                                        ""))
                                .then(Commands.argument("duration", StringArgumentType.word())
                                        .executes(ctx -> assign(ctx.getSource(),
                                                EntityArgument.getPlayer(ctx, "target"),
                                                StringArgumentType.getString(ctx, "role"),
                                                StringArgumentType.getString(ctx, "duration")))))));
    }

    private static int list(com.mojang.brigadier.context.CommandContext<CommandSourceStack> ctx) {
        ctx.getSource().sendSystemMessage(Component.literal("Roles: " + String.join(", ", RoleManager.ROLES.keySet())));
        return 1;
    }

    private static int show(CommandSourceStack source, ServerPlayer target) {
        RoleManager.Grant g = RoleManager.get(target.getUUID());
        if (g == null) {
            source.sendSystemMessage(Component.literal(target.getName().getString() + " has no role."));
        } else {
            String exp = g.expiresAtMs() < 0 ? "permanent"
                    : "expires in " + ((g.expiresAtMs() - System.currentTimeMillis()) / 1000) + "s";
            source.sendSystemMessage(Component.literal(
                    target.getName().getString() + " role: " + g.role() + " (" + exp + ")"));
        }
        return 1;
    }

    private static int assign(CommandSourceStack source, ServerPlayer target, String role, String duration) {
        if (!RoleManager.ROLES.containsKey(role)) {
            source.sendSystemMessage(Component.literal("Unknown role: " + role));
            return 0;
        }
        long ms = duration.isEmpty() ? 0 : RoleManager.parseDuration(duration);
        if (ms < 0) {
            source.sendSystemMessage(Component.literal("Invalid duration. Use e.g. 30s, 5m, 2h, 1d."));
            return 0;
        }
        RoleManager.grant(target.getUUID(), role, ms);
        String msg = "Role '" + role + "' granted to " + target.getName().getString()
                + (ms > 0 ? " for " + duration : " permanently") + ".";
        source.sendSystemMessage(Component.literal(msg));
        target.sendSystemMessage(Component.literal("You have been granted role: " + role
                + (ms > 0 ? " (for " + duration + ")" : " (permanent)")));
        return 1;
    }

    private static int revoke(CommandSourceStack source, ServerPlayer target) {
        RoleManager.Grant g = RoleManager.revoke(target.getUUID());
        if (g == null) {
            source.sendSystemMessage(Component.literal(target.getName().getString() + " has no role to revoke."));
            return 0;
        }
        source.sendSystemMessage(Component.literal("Revoked role '" + g.role() + "' from " + target.getName().getString()));
        target.sendSystemMessage(Component.literal("Your role '" + g.role() + "' has been revoked."));
        return 1;
    }
}
