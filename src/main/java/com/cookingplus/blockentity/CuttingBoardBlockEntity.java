package com.cookingplus.blockentity;

import com.cookingplus.item.KnifeItem;
import com.cookingplus.recipe.CuttingRecipe;
import com.cookingplus.registry.CPBlockEntities;
import com.cookingplus.registry.CPRecipeTypes;
import net.minecraft.core.BlockPos;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientGamePacketListener;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.Containers;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.jetbrains.annotations.Nullable;

import java.util.Optional;

public class CuttingBoardBlockEntity extends BlockEntity {
    private static final float MISCUT_CHANCE = 0.10f; // 10% per chop
    private static final float MISCUT_DAMAGE = 3.0f;  // 1.5 hearts

    private ItemStack stored = ItemStack.EMPTY;
    private int chopProgress = 0;

    public CuttingBoardBlockEntity(BlockPos pos, BlockState state) {
        super(CPBlockEntities.CUTTING_BOARD.get(), pos, state);
    }

    public ItemStack getStored() { return stored; }
    public int getChopProgress() { return chopProgress; }

    public InteractionResult handleInteraction(Player player, InteractionHand hand, ItemStack held) {
        if (level == null) return InteractionResult.PASS;

        // Holding a knife: try to chop
        if (held.getItem() instanceof KnifeItem) {
            return tryChop(player);
        }

        // Empty hand: take stored item back if any
        if (held.isEmpty() && !stored.isEmpty()) {
            ItemStack drop = stored.copy();
            stored = ItemStack.EMPTY;
            chopProgress = 0;
            if (!player.getInventory().add(drop)) {
                Containers.dropItemStack(level, getBlockPos().getX() + 0.5, getBlockPos().getY() + 0.5, getBlockPos().getZ() + 0.5, drop);
            }
            level.playSound(null, getBlockPos(), SoundEvents.ITEM_FRAME_REMOVE_ITEM, SoundSource.BLOCKS, 0.6f, 1.2f);
            sync();
            return InteractionResult.CONSUME;
        }

        // Place a single item from hand onto an empty board
        if (!held.isEmpty() && stored.isEmpty()) {
            stored = held.copyWithCount(1);
            held.shrink(1);
            chopProgress = 0;
            level.playSound(null, getBlockPos(), SoundEvents.ITEM_FRAME_ADD_ITEM, SoundSource.BLOCKS, 0.6f, 1.0f);
            sync();
            return InteractionResult.CONSUME;
        }

        return InteractionResult.PASS;
    }

    private InteractionResult tryChop(Player player) {
        if (stored.isEmpty()) return InteractionResult.PASS;

        Optional<CuttingRecipe> match = findRecipe();
        if (match.isEmpty()) {
            // Not a valid cutting target — visual feedback only
            level.playSound(null, getBlockPos(), SoundEvents.WOOD_HIT, SoundSource.BLOCKS, 0.3f, 0.8f);
            return InteractionResult.CONSUME;
        }
        CuttingRecipe recipe = match.get();

        // Random chance to miscut and damage the player (1.5 hearts).
        if (level.getRandom().nextFloat() < MISCUT_CHANCE) {
            player.hurt(level.damageSources().generic(), MISCUT_DAMAGE);
            level.playSound(null, getBlockPos(), SoundEvents.PLAYER_HURT, SoundSource.PLAYERS, 0.8f, 1.0f);
            // Miscut still counts as a chop so the player isn't stuck retrying
        }

        chopProgress++;
        level.playSound(null, getBlockPos(), SoundEvents.WOOL_BREAK, SoundSource.BLOCKS, 0.5f, 1.4f);

        if (chopProgress >= recipe.getChops()) {
            ItemStack out = recipe.getResultItem(level.registryAccess()).copy();
            stored = ItemStack.EMPTY;
            chopProgress = 0;
            // Eject the result on top of the board so the player can pick it up.
            Containers.dropItemStack(level, getBlockPos().getX() + 0.5, getBlockPos().getY() + 0.6, getBlockPos().getZ() + 0.5, out);
            level.playSound(null, getBlockPos(), SoundEvents.ITEM_PICKUP, SoundSource.BLOCKS, 0.5f, 1.6f);
        }
        sync();
        return InteractionResult.CONSUME;
    }

    private Optional<CuttingRecipe> findRecipe() {
        SimpleContainer c = new SimpleContainer(1);
        c.setItem(0, stored);
        return level.getRecipeManager().getRecipeFor(CPRecipeTypes.CUTTING.get(), c, level);
    }

    public void dropContents(Level level, BlockPos pos) {
        if (!stored.isEmpty()) {
            Containers.dropItemStack(level, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, stored);
        }
    }

    private void sync() {
        setChanged();
        if (level != null && !level.isClientSide) {
            level.sendBlockUpdated(getBlockPos(), getBlockState(), getBlockState(), 3);
        }
    }

    @Override
    protected void saveAdditional(CompoundTag tag) {
        super.saveAdditional(tag);
        if (!stored.isEmpty()) tag.put("Stored", stored.save(new CompoundTag()));
        tag.putInt("ChopProgress", chopProgress);
    }

    @Override
    public void load(CompoundTag tag) {
        super.load(tag);
        stored = tag.contains("Stored") ? ItemStack.of(tag.getCompound("Stored")) : ItemStack.EMPTY;
        chopProgress = tag.getInt("ChopProgress");
    }

    @Nullable
    @Override
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    @Override
    public CompoundTag getUpdateTag() {
        CompoundTag tag = super.getUpdateTag();
        if (!stored.isEmpty()) tag.put("Stored", stored.save(new CompoundTag()));
        tag.putInt("ChopProgress", chopProgress);
        return tag;
    }
}
