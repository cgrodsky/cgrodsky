package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.recipe.OvenRecipe;
import net.minecraft.world.item.crafting.RecipeSerializer;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class CPRecipeSerializers {
    public static final DeferredRegister<RecipeSerializer<?>> RECIPE_SERIALIZERS =
            DeferredRegister.create(ForgeRegistries.RECIPE_SERIALIZERS, CookingPlusMod.MODID);

    public static final RegistryObject<RecipeSerializer<OvenRecipe>> OVEN =
            RECIPE_SERIALIZERS.register("oven", OvenRecipe.Serializer::new);

    private CPRecipeSerializers() {}
}
