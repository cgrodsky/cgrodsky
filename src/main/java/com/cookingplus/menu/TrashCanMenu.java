package com.cookingplus.menu;

import com.cookingplus.blockentity.TrashCanBlockEntity;
import com.cookingplus.registry.CPBlocks;
import com.cookingplus.registry.CPMenus;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ContainerLevelAccess;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraftforge.items.SlotItemHandler;

public class TrashCanMenu extends AbstractContainerMenu {
    public static final int EMPTY_TRASH_BUTTON = 0;
    private static final int BE_SLOTS = TrashCanBlockEntity.SLOT_COUNT;

    private final TrashCanBlockEntity blockEntity;
    private final ContainerLevelAccess access;

    public TrashCanMenu(int id, Inventory inv, FriendlyByteBuf buf) {
        this(id, inv, lookupEntity(inv, buf.readBlockPos()));
    }

    public TrashCanMenu(int id, Inventory inv, TrashCanBlockEntity be) {
        super(CPMenus.TRASH_CAN.get(), id);
        this.blockEntity = be;
        this.access = ContainerLevelAccess.create(be.getLevel(), be.getBlockPos());

        // 3x9 trash grid at (8, 18)
        for (int row = 0; row < 3; row++) {
            for (int col = 0; col < 9; col++) {
                addSlot(new SlotItemHandler(be.getItems(), col + row * 9, 8 + col * 18, 18 + row * 18));
            }
        }

        // Player inventory: 3x9 + hotbar starting at (8, 84)
        for (int row = 0; row < 3; row++) {
            for (int col = 0; col < 9; col++) {
                addSlot(new Slot(inv, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
            }
        }
        for (int col = 0; col < 9; col++) {
            addSlot(new Slot(inv, col, 8 + col * 18, 142));
        }
    }

    private static TrashCanBlockEntity lookupEntity(Inventory inv, BlockPos pos) {
        BlockEntity be = inv.player.level().getBlockEntity(pos);
        if (be instanceof TrashCanBlockEntity tcBe) return tcBe;
        throw new IllegalStateException("TrashCanBlockEntity not found at " + pos);
    }

    @Override
    public boolean clickMenuButton(Player player, int id) {
        if (id == EMPTY_TRASH_BUTTON) {
            blockEntity.emptyTrash();
            broadcastChanges();
            return true;
        }
        return false;
    }

    @Override
    public ItemStack quickMoveStack(Player player, int index) {
        Slot slot = slots.get(index);
        if (!slot.hasItem()) return ItemStack.EMPTY;
        ItemStack stack = slot.getItem();
        ItemStack copy = stack.copy();
        if (index < BE_SLOTS) {
            // Trash -> player
            if (!moveItemStackTo(stack, BE_SLOTS, BE_SLOTS + 36, true)) return ItemStack.EMPTY;
        } else {
            // Player -> trash
            if (!moveItemStackTo(stack, 0, BE_SLOTS, false)) return ItemStack.EMPTY;
        }
        if (stack.isEmpty()) slot.set(ItemStack.EMPTY); else slot.setChanged();
        return copy;
    }

    @Override
    public boolean stillValid(Player player) {
        return stillValid(access, player, CPBlocks.TRASH_CAN.get());
    }

    public TrashCanBlockEntity getBlockEntity() { return blockEntity; }
}
