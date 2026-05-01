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

public class CuttingRecipe implements Recipe<Container> {
    public static final int DEFAULT_CHOPS = 4;

    private final ResourceLocation id;
    private final Ingredient input;
    private final ItemStack result;
    private final int chops;

    public CuttingRecipe(ResourceLocation id, Ingredient input, ItemStack result, int chops) {
        this.id = id;
        this.input = input;
        this.result = result;
        this.chops = chops;
    }

    public Ingredient getInput() { return input; }
    public int getChops() { return chops; }

    @Override public boolean matches(Container c, Level level) { return input.test(c.getItem(0)); }
    @Override public ItemStack assemble(Container c, RegistryAccess r) { return result.copy(); }
    @Override public boolean canCraftInDimensions(int w, int h) { return true; }
    @Override public ItemStack getResultItem(RegistryAccess r) { return result; }
    @Override public NonNullList<Ingredient> getIngredients() {
        NonNullList<Ingredient> l = NonNullList.create(); l.add(input); return l;
    }
    @Override public ResourceLocation getId() { return id; }
    @Override public RecipeSerializer<?> getSerializer() { return CPRecipeSerializers.CUTTING.get(); }
    @Override public RecipeType<?> getType() { return CPRecipeTypes.CUTTING.get(); }

    public static class Serializer implements RecipeSerializer<CuttingRecipe> {
        @Override
        public CuttingRecipe fromJson(ResourceLocation id, JsonObject json) {
            Ingredient input = Ingredient.fromJson(GsonHelper.getAsJsonObject(json, "ingredient"));
            ItemStack result = ShapedRecipe.itemStackFromJson(GsonHelper.getAsJsonObject(json, "result"));
            int chops = GsonHelper.getAsInt(json, "chops", DEFAULT_CHOPS);
            return new CuttingRecipe(id, input, result, chops);
        }
        @Override
        public CuttingRecipe fromNetwork(ResourceLocation id, FriendlyByteBuf buf) {
            return new CuttingRecipe(id, Ingredient.fromNetwork(buf), buf.readItem(), buf.readVarInt());
        }
        @Override
        public void toNetwork(FriendlyByteBuf buf, CuttingRecipe r) {
            r.input.toNetwork(buf);
            buf.writeItem(r.result);
            buf.writeVarInt(r.chops);
        }
    }
}
