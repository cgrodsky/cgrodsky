package com.cookingplus.blockentity;

import com.cookingplus.menu.OvenMenu;
import com.cookingplus.recipe.OvenRecipe;
import com.cookingplus.registry.CPBlockEntities;
import com.cookingplus.registry.CPRecipeTypes;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.NonNullList;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientGamePacketListener;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.world.Containers;
import net.minecraft.world.MenuProvider;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraftforge.common.capabilities.Capability;
import net.minecraftforge.common.capabilities.ForgeCapabilities;
import net.minecraftforge.common.util.LazyOptional;
import net.minecraftforge.items.IItemHandler;
import net.minecraftforge.items.ItemStackHandler;
import net.minecraftforge.items.wrapper.RecipeWrapper;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Optional;

public class OvenBlockEntity extends BlockEntity implements MenuProvider {
    public static final int INPUT_SLOT = 0;
    public static final int OUTPUT_SLOT = 1;
    public static final int SLOT_COUNT = 2;

    private final ItemStackHandler items = new ItemStackHandler(SLOT_COUNT) {
        @Override
        protected void onContentsChanged(int slot) {
            setChanged();
        }
    };
    private final LazyOptional<IItemHandler> itemHandlerCap = LazyOptional.of(() -> items);

    private int cookProgress = 0;
    private int cookTotal = 0;

    public OvenBlockEntity(BlockPos pos, BlockState state) {
        super(CPBlockEntities.OVEN.get(), pos, state);
    }

    public ItemStackHandler getItems() { return items; }
    public int getCookProgress() { return cookProgress; }
    public int getCookTotal() { return cookTotal; }

    public void serverTick(Level level, BlockPos pos, BlockState state) {
        ItemStack input = items.getStackInSlot(INPUT_SLOT);
        if (input.isEmpty()) {
            if (cookProgress != 0) { cookProgress = 0; cookTotal = 0; setChanged(level, pos, state); }
            return;
        }
        Optional<OvenRecipe> match = findMatch();
        if (match.isEmpty()) {
            if (cookProgress != 0) { cookProgress = 0; cookTotal = 0; setChanged(level, pos, state); }
            return;
        }
        OvenRecipe recipe = match.get();
        ItemStack result = recipe.getResultItem(level.registryAccess());
        ItemStack out = items.getStackInSlot(OUTPUT_SLOT);
        if (!canFitOutput(out, result)) return;

        cookTotal = recipe.getCookTime();
        cookProgress++;
        if (cookProgress >= cookTotal) {
            ItemStack copy = result.copy();
            if (out.isEmpty()) items.setStackInSlot(OUTPUT_SLOT, copy);
            else out.grow(copy.getCount());
            input.shrink(1);
            cookProgress = 0;
        }
        setChanged(level, pos, state);
    }

    private Optional<OvenRecipe> findMatch() {
        if (level == null) return Optional.empty();
        SimpleContainer c = new SimpleContainer(1);
        c.setItem(0, items.getStackInSlot(INPUT_SLOT));
        return level.getRecipeManager().getRecipeFor(CPRecipeTypes.OVEN.get(), c, level);
    }

    private boolean canFitOutput(ItemStack out, ItemStack result) {
        if (out.isEmpty()) return true;
        if (!ItemStack.isSameItemSameTags(out, result)) return false;
        return out.getCount() + result.getCount() <= out.getMaxStackSize();
    }

    public void dropContents(Level level, BlockPos pos) {
        NonNullList<ItemStack> drops = NonNullList.create();
        for (int i = 0; i < items.getSlots(); i++) drops.add(items.getStackInSlot(i));
        Containers.dropContents(level, pos, drops);
    }

    @Override
    public @NotNull <T> LazyOptional<T> getCapability(@NotNull Capability<T> cap, @Nullable Direction side) {
        if (cap == ForgeCapabilities.ITEM_HANDLER) return itemHandlerCap.cast();
        return super.getCapability(cap, side);
    }

    @Override
    public void invalidateCaps() {
        super.invalidateCaps();
        itemHandlerCap.invalidate();
    }

    @Override
    protected void saveAdditional(CompoundTag tag) {
        super.saveAdditional(tag);
        tag.put("Items", items.serializeNBT());
        tag.putInt("CookProgress", cookProgress);
        tag.putInt("CookTotal", cookTotal);
    }

    @Override
    public void load(CompoundTag tag) {
        super.load(tag);
        if (tag.contains("Items")) items.deserializeNBT(tag.getCompound("Items"));
        cookProgress = tag.getInt("CookProgress");
        cookTotal = tag.getInt("CookTotal");
    }

    @Nullable
    @Override
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    @Override
    public CompoundTag getUpdateTag() {
        CompoundTag tag = super.getUpdateTag();
        tag.put("Items", items.serializeNBT());
        return tag;
    }

    @Override
    public Component getDisplayName() {
        return Component.translatable("container.cookingplus.oven");
    }

    @Nullable
    @Override
    public AbstractContainerMenu createMenu(int containerId, Inventory inv, Player player) {
        return new OvenMenu(containerId, inv, this);
    }
}
