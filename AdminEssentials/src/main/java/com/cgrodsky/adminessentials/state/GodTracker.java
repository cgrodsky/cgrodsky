package com.cgrodsky.adminessentials.state;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public final class GodTracker {
    private static final Set<UUID> GOD = new HashSet<>();

    private GodTracker() {}

    public static boolean isGod(UUID uuid) { return GOD.contains(uuid); }

    public static boolean toggle(UUID uuid) {
        if (GOD.contains(uuid)) { GOD.remove(uuid); return false; }
        GOD.add(uuid);
        return true;
    }
}
