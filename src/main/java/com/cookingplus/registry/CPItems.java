package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.item.KnifeItem;
import net.minecraft.world.food.FoodProperties;
import net.minecraft.world.item.Item;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class CPItems {
    public static final DeferredRegister<Item> ITEMS =
            DeferredRegister.create(ForgeRegistries.ITEMS, CookingPlusMod.MODID);

    public static final RegistryObject<Item> KNIFE = ITEMS.register("knife",
            () -> new KnifeItem(new Item.Properties().stacksTo(1).durability(120)));

    // Sliced ingredients
    public static final RegistryObject<Item> SLICED_BREAD = ITEMS.register("sliced_bread",
            () -> new Item(new Item.Properties().food(food(2, 0.3f))));

    // Fruits
    public static final RegistryObject<Item> LEMON  = ITEMS.register("lemon",  () -> new Item(new Item.Properties().food(food(2, 0.2f))));
    public static final RegistryObject<Item> PEAR   = ITEMS.register("pear",   () -> new Item(new Item.Properties().food(food(4, 0.4f))));
    public static final RegistryObject<Item> BANANA = ITEMS.register("banana", () -> new Item(new Item.Properties().food(food(4, 0.5f))));
    public static final RegistryObject<Item> ORANGE = ITEMS.register("orange", () -> new Item(new Item.Properties().food(food(4, 0.4f))));
    public static final RegistryObject<Item> KIWI   = ITEMS.register("kiwi",   () -> new Item(new Item.Properties().food(food(3, 0.3f))));

    // Sauces (small saturation, can stack)
    public static final RegistryObject<Item> SOY_SAUCE   = ITEMS.register("soy_sauce",   () -> new Item(new Item.Properties().food(food(1, 0.6f))));
    public static final RegistryObject<Item> TAJIN_SAUCE = ITEMS.register("tajin_sauce", () -> new Item(new Item.Properties().food(food(1, 0.5f))));
    public static final RegistryObject<Item> TANGY_SAUCE = ITEMS.register("tangy_sauce", () -> new Item(new Item.Properties().food(food(1, 0.5f))));

    private static FoodProperties food(int nutrition, float saturationMod) {
        return new FoodProperties.Builder().nutrition(nutrition).saturationMod(saturationMod).build();
    }

    private CPItems() {}
}
