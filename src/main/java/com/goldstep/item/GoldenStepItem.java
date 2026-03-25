package com.goldstep.item;

import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class GoldenStepItem extends Item {

    private static final int DURATION_TICKS = 200;   // 10 seconds (20 ticks/sec)
    private static final int COOLDOWN_TICKS = 200;   // 10 seconds cooldown

    // Track active players and when their effect expires
    private static final Map<UUID, Long> activeUntil = new HashMap<>();

    public GoldenStepItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);

        if (!level.isClientSide) {
            // Activate the golden step effect
            long gameTime = level.getGameTime();
            activeUntil.put(player.getUUID(), gameTime + DURATION_TICKS);

            // Apply cooldown (duration + cooldown so it can't be reused while active)
            player.getCooldowns().addCooldown(this, DURATION_TICKS + COOLDOWN_TICKS);

            player.displayClientMessage(
                    Component.literal("Golden Step activated! (10s)")
                            .withStyle(ChatFormatting.GOLD),
                    true
            );

            level.playSound(null, player.blockPosition(), SoundEvents.BEACON_ACTIVATE,
                    SoundSource.PLAYERS, 1.0f, 1.5f);
        }

        return InteractionResultHolder.sidedSuccess(stack, level.isClientSide);
    }

    @Override
    public void inventoryTick(ItemStack stack, Level level, Entity entity, int slotId, boolean isSelected) {
        if (level.isClientSide || !(entity instanceof Player player)) return;

        UUID playerId = player.getUUID();
        Long expireTime = activeUntil.get(playerId);
        if (expireTime == null) return;

        long gameTime = level.getGameTime();

        // Check if effect has expired
        if (gameTime > expireTime) {
            activeUntil.remove(playerId);
            player.displayClientMessage(
                    Component.literal("Golden Step wore off!")
                            .withStyle(ChatFormatting.GRAY),
                    true
            );
            level.playSound(null, player.blockPosition(), SoundEvents.BEACON_DEACTIVATE,
                    SoundSource.PLAYERS, 1.0f, 1.0f);
            return;
        }

        // Convert blocks around the player's feet into gold
        BlockPos playerPos = player.blockPosition();
        int radius = 1;

        for (int dx = -radius; dx <= radius; dx++) {
            for (int dz = -radius; dz <= radius; dz++) {
                // Convert the block the player is standing on and adjacent blocks
                BlockPos belowPos = playerPos.offset(dx, -1, dz);
                BlockState state = level.getBlockState(belowPos);

                // Don't convert air, bedrock, fluids, or blocks that are already gold
                if (!state.isAir()
                        && !state.is(Blocks.BEDROCK)
                        && !state.is(Blocks.GOLD_BLOCK)
                        && !state.liquid()
                        && state.getDestroySpeed(level, belowPos) >= 0) {
                    level.setBlock(belowPos, Blocks.GOLD_BLOCK.defaultBlockState(), 3);
                }
            }
        }
    }

    @Override
    public boolean isFoil(ItemStack stack) {
        // Give the item an enchanted glint
        return true;
    }

    @Override
    public void appendHoverText(ItemStack stack, @Nullable Level level, List<Component> tooltip,
                                 TooltipFlag flag) {
        tooltip.add(Component.literal("Right-click to activate!")
                .withStyle(ChatFormatting.GRAY));
        tooltip.add(Component.literal("Turns blocks beneath you into gold")
                .withStyle(ChatFormatting.GOLD));
        tooltip.add(Component.literal("Duration: 10s | Cooldown: 10s")
                .withStyle(ChatFormatting.DARK_GRAY));
    }
}
