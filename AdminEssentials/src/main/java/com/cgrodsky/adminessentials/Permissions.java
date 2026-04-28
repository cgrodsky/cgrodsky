package com.cgrodsky.adminessentials;

import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.server.permission.PermissionAPI;
import net.minecraftforge.server.permission.events.PermissionGatherEvent;
import net.minecraftforge.server.permission.nodes.PermissionNode;
import net.minecraftforge.server.permission.nodes.PermissionTypes;

public final class Permissions {
    public static final PermissionNode<Boolean> SUDO = opNode("command.sudo");
    public static final PermissionNode<Boolean> ADMIN_CHAT = opNode("command.adminchat");
    public static final PermissionNode<Boolean> XRAY_ALERTS = opNode("command.xrayalerts");

    public static void onGather(PermissionGatherEvent.Nodes event) {
        event.addNodes(SUDO, ADMIN_CHAT, XRAY_ALERTS);
    }

    public static boolean has(CommandSourceStack source, PermissionNode<Boolean> node) {
        if (source.getEntity() instanceof ServerPlayer p) {
            return PermissionAPI.getPermission(p, node);
        }
        return source.hasPermission(2);
    }

    private static PermissionNode<Boolean> opNode(String name) {
        return new PermissionNode<>(AdminEssentials.MODID, name, PermissionTypes.BOOLEAN,
                (player, uuid, ctx) -> player != null && player.hasPermissions(2));
    }

    private Permissions() {}
}
