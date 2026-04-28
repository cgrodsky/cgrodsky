package com.cgrodsky.adminessentials.alerts;

import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;

import java.util.Set;

public final class WatchedOres {
    public static final Set<Block> DEFAULT = Set.of(
            Blocks.DIAMOND_ORE,
            Blocks.DEEPSLATE_DIAMOND_ORE,
            Blocks.ANCIENT_DEBRIS,
            Blocks.EMERALD_ORE,
            Blocks.DEEPSLATE_EMERALD_ORE
    );

    private WatchedOres() {}
}
