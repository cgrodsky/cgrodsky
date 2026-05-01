package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.RegistryObject;

public final class CPCreativeTabs {
    public static final DeferredRegister<CreativeModeTab> TABS =
            DeferredRegister.create(Registries.CREATIVE_MODE_TAB, CookingPlusMod.MODID);

    public static final RegistryObject<CreativeModeTab> COOKING_TAB = TABS.register("cooking_tab",
            () -> CreativeModeTab.builder()
                    .title(Component.translatable("itemGroup.cookingplus"))
                    .icon(() -> new ItemStack(CPBlocks.OVEN.get()))
                    .displayItems((params, output) -> {
                        CPItems.ITEMS.getEntries().forEach(reg -> output.accept(reg.get()));
                    })
                    .build());

    private CPCreativeTabs() {}
}
