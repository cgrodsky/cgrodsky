package com.cgrodsky.adminessentials;

import com.cgrodsky.adminessentials.state.RoleManager;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.server.permission.PermissionAPI;
import net.minecraftforge.server.permission.events.PermissionGatherEvent;
import net.minecraftforge.server.permission.nodes.PermissionNode;
import net.minecraftforge.server.permission.nodes.PermissionTypes;

public final class Permissions {
    public static final PermissionNode<Boolean> SUDO        = opNode("command.sudo");
    public static final PermissionNode<Boolean> ADMIN_CHAT  = opNode("command.adminchat");
    public static final PermissionNode<Boolean> XRAY_ALERTS = opNode("command.xrayalerts");
    public static final PermissionNode<Boolean> VANISH      = opNode("command.vanish");
    public static final PermissionNode<Boolean> XRAY        = opNode("command.xray");
    public static final PermissionNode<Boolean> ATP         = opNode("command.atp");
    public static final PermissionNode<Boolean> HEAL        = opNode("command.heal");
    public static final PermissionNode<Boolean> FEED        = opNode("command.feed");
    public static final PermissionNode<Boolean> GOD         = opNode("command.god");
    public static final PermissionNode<Boolean> FLY         = opNode("command.fly");
    public static final PermissionNode<Boolean> SPEED       = opNode("command.speed");
    public static final PermissionNode<Boolean> HOME        = opNode("command.home");
    public static final PermissionNode<Boolean> WARP        = opNode("command.warp");
    public static final PermissionNode<Boolean> WARP_SET    = opNode("command.setwarp");
    public static final PermissionNode<Boolean> BACK        = opNode("command.back");
    public static final PermissionNode<Boolean> MORPH       = opNode("command.morph");
    public static final PermissionNode<Boolean> SPAWN       = opNode("command.spawn");
    public static final PermissionNode<Boolean> SPAWN_SET   = opNode("command.spawnw");
    public static final PermissionNode<Boolean> PROTECTION_BYPASS = opNode("protection.bypass");
    public static final PermissionNode<Boolean> ROLE        = opNode("command.role");

    public static void onGather(PermissionGatherEvent.Nodes event) {
        event.addNodes(
            SUDO, ADMIN_CHAT, XRAY_ALERTS,
            VANISH, XRAY, ATP,
            HEAL, FEED, GOD, FLY, SPEED,
            HOME, WARP, WARP_SET, BACK,
            MORPH, SPAWN, SPAWN_SET, PROTECTION_BYPASS,
            ROLE
        );
    }

    public static boolean has(CommandSourceStack source, PermissionNode<Boolean> node) {
        if (source.getEntity() instanceof ServerPlayer p) {
            return has(p, node);
        }
        return source.hasPermission(2);
    }

    public static boolean has(ServerPlayer player, PermissionNode<Boolean> node) {
        if (PermissionAPI.getPermission(player, node)) return true;
        return RoleManager.has(player.getUUID(), node);
    }

    private static PermissionNode<Boolean> opNode(String name) {
        return new PermissionNode<>(AdminEssentials.MODID, name, PermissionTypes.BOOLEAN,
                (player, uuid, ctx) -> player != null && player.hasPermissions(2));
    }

    private Permissions() {}
}
