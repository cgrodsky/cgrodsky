package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.recipe.CuttingRecipe;
import com.cookingplus.recipe.OvenRecipe;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.crafting.RecipeType;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class CPRecipeTypes {
    public static final DeferredRegister<RecipeType<?>> RECIPE_TYPES =
            DeferredRegister.create(ForgeRegistries.RECIPE_TYPES, CookingPlusMod.MODID);

    public static final RegistryObject<RecipeType<OvenRecipe>> OVEN =
            RECIPE_TYPES.register("oven", () -> RecipeType.simple(new ResourceLocation(CookingPlusMod.MODID, "oven")));

    public static final RegistryObject<RecipeType<CuttingRecipe>> CUTTING =
            RECIPE_TYPES.register("cutting", () -> RecipeType.simple(new ResourceLocation(CookingPlusMod.MODID, "cutting")));

    private CPRecipeTypes() {}
}
