package com.cookingplus.item;

import net.minecraft.world.item.Item;

/**
 * A kitchen knife. Used by right-clicking a cutting board that has a food
 * stack placed on it; each click chops the food and risks cutting the player.
 * Standalone use as a weapon is intentionally minimal.
 */
public class KnifeItem extends Item {
    public KnifeItem(Properties props) {
        super(props);
    }
}
