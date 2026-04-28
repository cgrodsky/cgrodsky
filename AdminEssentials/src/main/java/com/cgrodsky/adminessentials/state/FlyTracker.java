package com.cgrodsky.adminessentials.state;

import net.minecraft.server.level.ServerPlayer;

public final class FlyTracker {
    private FlyTracker() {}

    public static boolean toggle(ServerPlayer player) {
        boolean newState = !player.getAbilities().mayfly;
        player.getAbilities().mayfly = newState;
        if (!newState) player.getAbilities().flying = false;
        player.onUpdateAbilities();
        return newState;
    }
}
