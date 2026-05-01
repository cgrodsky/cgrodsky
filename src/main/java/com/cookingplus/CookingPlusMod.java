package com.cookingplus;

import com.cookingplus.registry.CPBlockEntities;
import com.cookingplus.registry.CPBlocks;
import com.cookingplus.registry.CPCreativeTabs;
import com.cookingplus.registry.CPItems;
import com.cookingplus.registry.CPMenus;
import com.cookingplus.registry.CPRecipeSerializers;
import com.cookingplus.registry.CPRecipeTypes;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod(CookingPlusMod.MODID)
public class CookingPlusMod {
    public static final String MODID = "cookingplus";
    public static final Logger LOGGER = LogManager.getLogger();

    public CookingPlusMod() {
        IEventBus modEventBus = FMLJavaModLoadingContext.get().getModEventBus();

        CPItems.ITEMS.register(modEventBus);
        CPBlocks.BLOCKS.register(modEventBus);
        CPBlockEntities.BLOCK_ENTITIES.register(modEventBus);
        CPMenus.MENUS.register(modEventBus);
        CPRecipeTypes.RECIPE_TYPES.register(modEventBus);
        CPRecipeSerializers.RECIPE_SERIALIZERS.register(modEventBus);
        CPCreativeTabs.TABS.register(modEventBus);

        MinecraftForge.EVENT_BUS.register(this);
    }
}
