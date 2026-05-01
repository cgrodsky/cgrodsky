package com.cookingplus.recipe;

import com.cookingplus.registry.CPRecipeSerializers;
import com.cookingplus.registry.CPRecipeTypes;
import com.google.gson.JsonObject;
import net.minecraft.core.NonNullList;
import net.minecraft.core.RegistryAccess;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.GsonHelper;
import net.minecraft.world.Container;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.item.crafting.RecipeSerializer;
import net.minecraft.world.item.crafting.RecipeType;
import net.minecraft.world.item.crafting.ShapedRecipe;
import net.minecraft.world.level.Level;

public class OvenRecipe implements Recipe<Container> {
    public static final int DEFAULT_COOK_TIME = 200;

    private final ResourceLocation id;
    private final Ingredient input;
    private final ItemStack result;
    private final int cookTime;

    public OvenRecipe(ResourceLocation id, Ingredient input, ItemStack result, int cookTime) {
        this.id = id;
        this.input = input;
        this.result = result;
        this.cookTime = cookTime;
    }

    public Ingredient getInput() { return input; }
    public int getCookTime() { return cookTime; }

    @Override
    public boolean matches(Container container, Level level) {
        return input.test(container.getItem(0));
    }

    @Override
    public ItemStack assemble(Container container, RegistryAccess registryAccess) {
        return result.copy();
    }

    @Override
    public boolean canCraftInDimensions(int width, int height) { return true; }

    @Override
    public ItemStack getResultItem(RegistryAccess registryAccess) { return result; }

    @Override
    public NonNullList<Ingredient> getIngredients() {
        NonNullList<Ingredient> list = NonNullList.create();
        list.add(input);
        return list;
    }

    @Override
    public ResourceLocation getId() { return id; }

    @Override
    public RecipeSerializer<?> getSerializer() { return CPRecipeSerializers.OVEN.get(); }

    @Override
    public RecipeType<?> getType() { return CPRecipeTypes.OVEN.get(); }

    public static class Serializer implements RecipeSerializer<OvenRecipe> {
        @Override
        public OvenRecipe fromJson(ResourceLocation id, JsonObject json) {
            Ingredient input = Ingredient.fromJson(GsonHelper.getAsJsonObject(json, "ingredient"));
            ItemStack result = ShapedRecipe.itemStackFromJson(GsonHelper.getAsJsonObject(json, "result"));
            int cookTime = GsonHelper.getAsInt(json, "cook_time", DEFAULT_COOK_TIME);
            return new OvenRecipe(id, input, result, cookTime);
        }

        @Override
        public OvenRecipe fromNetwork(ResourceLocation id, FriendlyByteBuf buf) {
            Ingredient input = Ingredient.fromNetwork(buf);
            ItemStack result = buf.readItem();
            int cookTime = buf.readVarInt();
            return new OvenRecipe(id, input, result, cookTime);
        }

        @Override
        public void toNetwork(FriendlyByteBuf buf, OvenRecipe recipe) {
            recipe.input.toNetwork(buf);
            buf.writeItem(recipe.result);
            buf.writeVarInt(recipe.cookTime);
        }
    }
}
