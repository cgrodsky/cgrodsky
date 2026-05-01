package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.menu.OvenMenu;
import com.cookingplus.menu.TrashCanMenu;
import net.minecraft.world.inventory.MenuType;
import net.minecraftforge.common.extensions.IForgeMenuType;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class CPMenus {
    public static final DeferredRegister<MenuType<?>> MENUS =
            DeferredRegister.create(ForgeRegistries.MENU_TYPES, CookingPlusMod.MODID);

    public static final RegistryObject<MenuType<OvenMenu>> OVEN =
            MENUS.register("oven", () -> IForgeMenuType.create(OvenMenu::new));

    public static final RegistryObject<MenuType<TrashCanMenu>> TRASH_CAN =
            MENUS.register("trash_can", () -> IForgeMenuType.create(TrashCanMenu::new));

    private CPMenus() {}
}
