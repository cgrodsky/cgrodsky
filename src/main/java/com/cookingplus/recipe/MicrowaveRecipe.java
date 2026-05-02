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

public class MicrowaveRecipe implements Recipe<Container> {
    public static final int DEFAULT_COOK_TIME = 100; // 5 seconds

    private final ResourceLocation id;
    private final Ingredient input;
    private final ItemStack result;
    private final int cookTime;

    public MicrowaveRecipe(ResourceLocation id, Ingredient input, ItemStack result, int cookTime) {
        this.id = id;
        this.input = input;
        this.result = result;
        this.cookTime = cookTime;
    }

    public Ingredient getInput() { return input; }
    public int getCookTime() { return cookTime; }

    @Override public boolean matches(Container c, Level level) { return input.test(c.getItem(0)); }
    @Override public ItemStack assemble(Container c, RegistryAccess r) { return result.copy(); }
    @Override public boolean canCraftInDimensions(int w, int h) { return true; }
    @Override public ItemStack getResultItem(RegistryAccess r) { return result; }
    @Override public NonNullList<Ingredient> getIngredients() {
        NonNullList<Ingredient> l = NonNullList.create();
        l.add(input);
        return l;
    }
    @Override public ResourceLocation getId() { return id; }
    @Override public RecipeSerializer<?> getSerializer() { return CPRecipeSerializers.MICROWAVE.get(); }
    @Override public RecipeType<?> getType() { return CPRecipeTypes.MICROWAVE.get(); }

    public static class Serializer implements RecipeSerializer<MicrowaveRecipe> {
        @Override
        public MicrowaveRecipe fromJson(ResourceLocation id, JsonObject json) {
            Ingredient input = Ingredient.fromJson(GsonHelper.getAsJsonObject(json, "ingredient"));
            ItemStack result = ShapedRecipe.itemStackFromJson(GsonHelper.getAsJsonObject(json, "result"));
            int cookTime = GsonHelper.getAsInt(json, "cook_time", DEFAULT_COOK_TIME);
            return new MicrowaveRecipe(id, input, result, cookTime);
        }
        @Override
        public MicrowaveRecipe fromNetwork(ResourceLocation id, FriendlyByteBuf buf) {
            return new MicrowaveRecipe(id, Ingredient.fromNetwork(buf), buf.readItem(), buf.readVarInt());
        }
        @Override
        public void toNetwork(FriendlyByteBuf buf, MicrowaveRecipe r) {
            r.input.toNetwork(buf);
            buf.writeItem(r.result);
            buf.writeVarInt(r.cookTime);
        }
    }
}
