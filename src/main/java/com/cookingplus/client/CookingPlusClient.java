package com.cookingplus.client;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.client.renderer.CuttingBoardRenderer;
import com.cookingplus.client.screen.OvenScreen;
import com.cookingplus.client.screen.TrashCanScreen;
import com.cookingplus.registry.CPBlockEntities;
import com.cookingplus.registry.CPMenus;
import net.minecraft.client.gui.screens.MenuScreens;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.EntityRenderersEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLClientSetupEvent;

@Mod.EventBusSubscriber(modid = CookingPlusMod.MODID, value = Dist.CLIENT, bus = Mod.EventBusSubscriber.Bus.MOD)
public final class CookingPlusClient {

    private CookingPlusClient() {}

    @SubscribeEvent
    public static void onClientSetup(FMLClientSetupEvent event) {
        event.enqueueWork(() -> {
            MenuScreens.register(CPMenus.OVEN.get(), OvenScreen::new);
            MenuScreens.register(CPMenus.TRASH_CAN.get(), TrashCanScreen::new);
        });
    }

    @SubscribeEvent
    public static void onRegisterBlockEntityRenderers(EntityRenderersEvent.RegisterRenderers event) {
        event.registerBlockEntityRenderer(CPBlockEntities.CUTTING_BOARD.get(), CuttingBoardRenderer::new);
    }
}
