package com.cookingplus.event;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.block.TrashCanBlock;
import com.cookingplus.blockentity.TrashCanBlockEntity;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.entity.player.PlayerInteractEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

@Mod.EventBusSubscriber(modid = CookingPlusMod.MODID, bus = Mod.EventBusSubscriber.Bus.FORGE)
public final class CPEvents {

    private CPEvents() {}

    @SubscribeEvent
    public static void onLeftClickBlock(PlayerInteractEvent.LeftClickBlock event) {
        Level level = event.getLevel();
        BlockPos pos = event.getPos();
        BlockState state = level.getBlockState(pos);
        if (!(state.getBlock() instanceof TrashCanBlock)) return;

        Player player = event.getEntity();
        ItemStack held = player.getMainHandItem();
        if (held.isEmpty()) return;          // empty hand: allow normal break behaviour
        if (player.isShiftKeyDown()) return; // shift+left-click: allow normal break

        if (!level.isClientSide) {
            BlockEntity be = level.getBlockEntity(pos);
            if (be instanceof TrashCanBlockEntity tcBe) {
                ItemStack leftover = tcBe.tryDeposit(held);
                player.setItemInHand(InteractionHand.MAIN_HAND, leftover);
                level.playSound(null, pos, SoundEvents.UI_BUTTON_CLICK.value(), SoundSource.BLOCKS, 0.5f, 0.9f);
            }
        }
        event.setCanceled(true);
    }
}
