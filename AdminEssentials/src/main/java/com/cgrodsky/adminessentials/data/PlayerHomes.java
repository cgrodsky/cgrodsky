package com.cgrodsky.adminessentials.data;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;

import java.util.HashSet;
import java.util.Set;

public final class PlayerHomes {
    private static final String ROOT_KEY = "adminessentials_homes";

    public record Home(ResourceKey<Level> dim, double x, double y, double z, float yaw, float pitch) {}

    private PlayerHomes() {}

    private static CompoundTag root(Player player) {
        CompoundTag persistent = player.getPersistentData();
        CompoundTag forgeTag = persistent.contains("PlayerPersisted")
                ? persistent.getCompound("PlayerPersisted")
                : new CompoundTag();
        if (!forgeTag.contains(ROOT_KEY)) forgeTag.put(ROOT_KEY, new CompoundTag());
        persistent.put("PlayerPersisted", forgeTag);
        return forgeTag.getCompound(ROOT_KEY);
    }

    public static void set(ServerPlayer player, String name, Home home) {
        CompoundTag homes = root(player);
        CompoundTag entry = new CompoundTag();
        entry.putString("dim", home.dim.location().toString());
        entry.putDouble("x", home.x); entry.putDouble("y", home.y); entry.putDouble("z", home.z);
        entry.putFloat("yaw", home.yaw); entry.putFloat("pitch", home.pitch);
        homes.put(name.toLowerCase(), entry);
    }

    public static Home get(ServerPlayer player, String name) {
        CompoundTag homes = root(player);
        if (!homes.contains(name.toLowerCase())) return null;
        CompoundTag t = homes.getCompound(name.toLowerCase());
        ResourceKey<Level> dim = ResourceKey.create(net.minecraft.core.registries.Registries.DIMENSION,
                new ResourceLocation(t.getString("dim")));
        return new Home(dim, t.getDouble("x"), t.getDouble("y"), t.getDouble("z"),
                t.getFloat("yaw"), t.getFloat("pitch"));
    }

    public static boolean remove(ServerPlayer player, String name) {
        CompoundTag homes = root(player);
        if (!homes.contains(name.toLowerCase())) return false;
        homes.remove(name.toLowerCase());
        return true;
    }

    public static Set<String> names(ServerPlayer player) {
        return new HashSet<>(root(player).getAllKeys());
    }
}
