package com.cookingplus.menu;

import com.cookingplus.blockentity.OvenBlockEntity;
import com.cookingplus.registry.CPBlocks;
import com.cookingplus.registry.CPMenus;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ContainerLevelAccess;
import net.minecraft.world.inventory.DataSlot;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraftforge.items.SlotItemHandler;

public class OvenMenu extends AbstractContainerMenu {
    private final OvenBlockEntity blockEntity;
    private final ContainerLevelAccess access;
    private final DataSlot cookProgress = DataSlot.standalone();
    private final DataSlot cookTotal = DataSlot.standalone();

    public OvenMenu(int id, Inventory inv, FriendlyByteBuf buf) {
        this(id, inv, lookupEntity(inv, buf.readBlockPos()));
    }

    public OvenMenu(int id, Inventory inv, OvenBlockEntity be) {
        super(CPMenus.OVEN.get(), id);
        this.blockEntity = be;
        this.access = ContainerLevelAccess.create(be.getLevel(), be.getBlockPos());

        addSlot(new SlotItemHandler(be.getItems(), OvenBlockEntity.INPUT_SLOT, 56, 35));
        addSlot(new SlotItemHandler(be.getItems(), OvenBlockEntity.OUTPUT_SLOT, 116, 35) {
            @Override public boolean mayPlace(ItemStack stack) { return false; }
        });

        addPlayerInventory(inv);

        addDataSlot(cookProgress);
        addDataSlot(cookTotal);
    }

    private static OvenBlockEntity lookupEntity(Inventory inv, BlockPos pos) {
        BlockEntity be = inv.player.level().getBlockEntity(pos);
        if (be instanceof OvenBlockEntity ovenBe) return ovenBe;
        throw new IllegalStateException("OvenBlockEntity not found at " + pos);
    }

    private void addPlayerInventory(Inventory inv) {
        for (int row = 0; row < 3; row++) {
            for (int col = 0; col < 9; col++) {
                addSlot(new Slot(inv, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
            }
        }
        for (int col = 0; col < 9; col++) {
            addSlot(new Slot(inv, col, 8 + col * 18, 142));
        }
    }

    @Override
    public void broadcastChanges() {
        cookProgress.set(blockEntity.getCookProgress());
        cookTotal.set(blockEntity.getCookTotal());
        super.broadcastChanges();
    }

    public int getCookProgress() { return cookProgress.get(); }
    public int getCookTotal() { return cookTotal.get(); }

    public int getProgressPixels(int pixels) {
        int total = cookTotal.get();
        if (total == 0) return 0;
        return cookProgress.get() * pixels / total;
    }

    @Override
    public ItemStack quickMoveStack(Player player, int index) {
        Slot slot = slots.get(index);
        if (!slot.hasItem()) return ItemStack.EMPTY;
        ItemStack stack = slot.getItem();
        ItemStack copy = stack.copy();
        final int beSlots = OvenBlockEntity.SLOT_COUNT;
        final int playerStart = beSlots;
        final int playerEnd = beSlots + 36;
        if (index < beSlots) {
            if (!moveItemStackTo(stack, playerStart, playerEnd, true)) return ItemStack.EMPTY;
        } else {
            if (!moveItemStackTo(stack, OvenBlockEntity.INPUT_SLOT, OvenBlockEntity.INPUT_SLOT + 1, false)) return ItemStack.EMPTY;
        }
        if (stack.isEmpty()) slot.set(ItemStack.EMPTY); else slot.setChanged();
        return copy;
    }

    @Override
    public boolean stillValid(Player player) {
        return stillValid(access, player, CPBlocks.OVEN.get());
    }

    public OvenBlockEntity getBlockEntity() { return blockEntity; }
}
