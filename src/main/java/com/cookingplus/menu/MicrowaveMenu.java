package com.cookingplus.menu;

import com.cookingplus.blockentity.MicrowaveBlockEntity;
import com.cookingplus.registry.CPBlocks;
import com.cookingplus.registry.CPMenus;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ContainerLevelAccess;
import net.minecraft.world.inventory.DataSlot;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraftforge.items.SlotItemHandler;

public class MicrowaveMenu extends AbstractContainerMenu {
    private final MicrowaveBlockEntity blockEntity;
    private final ContainerLevelAccess access;
    private final DataSlot cookProgress = DataSlot.standalone();
    private final DataSlot cookTotal = DataSlot.standalone();

    public MicrowaveMenu(int id, Inventory inv, FriendlyByteBuf buf) {
        this(id, inv, lookupEntity(inv, buf.readBlockPos()));
    }

    public MicrowaveMenu(int id, Inventory inv, MicrowaveBlockEntity be) {
        super(CPMenus.MICROWAVE.get(), id);
        this.blockEntity = be;
        this.access = ContainerLevelAccess.create(be.getLevel(), be.getBlockPos());

        addSlot(new SlotItemHandler(be.getItems(), MicrowaveBlockEntity.INPUT_SLOT, 56, 35));
        addSlot(new SlotItemHandler(be.getItems(), MicrowaveBlockEntity.OUTPUT_SLOT, 116, 35) {
            @Override public boolean mayPlace(ItemStack stack) { return false; }
        });

        for (int row = 0; row < 3; row++)
            for (int col = 0; col < 9; col++)
                addSlot(new Slot(inv, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
        for (int col = 0; col < 9; col++)
            addSlot(new Slot(inv, col, 8 + col * 18, 142));

        addDataSlot(cookProgress);
        addDataSlot(cookTotal);
    }

    private static MicrowaveBlockEntity lookupEntity(Inventory inv, BlockPos pos) {
        BlockEntity be = inv.player.level().getBlockEntity(pos);
        if (be instanceof MicrowaveBlockEntity mwBe) return mwBe;
        throw new IllegalStateException("MicrowaveBlockEntity not found at " + pos);
    }

    @Override
    public void broadcastChanges() {
        cookProgress.set(blockEntity.getCookProgress());
        cookTotal.set(blockEntity.getCookTotal());
        super.broadcastChanges();
    }

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
        final int beSlots = MicrowaveBlockEntity.SLOT_COUNT;
        if (index < beSlots) {
            if (!moveItemStackTo(stack, beSlots, beSlots + 36, true)) return ItemStack.EMPTY;
        } else {
            if (!moveItemStackTo(stack, MicrowaveBlockEntity.INPUT_SLOT, MicrowaveBlockEntity.INPUT_SLOT + 1, false)) return ItemStack.EMPTY;
        }
        if (stack.isEmpty()) slot.set(ItemStack.EMPTY); else slot.setChanged();
        return copy;
    }

    @Override
    public boolean stillValid(Player player) {
        return stillValid(access, player, CPBlocks.MICROWAVE.get());
    }
}
