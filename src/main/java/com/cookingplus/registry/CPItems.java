package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import net.minecraft.world.item.Item;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;

public final class CPItems {
    public static final DeferredRegister<Item> ITEMS =
            DeferredRegister.create(ForgeRegistries.ITEMS, CookingPlusMod.MODID);

    private CPItems() {}
}
