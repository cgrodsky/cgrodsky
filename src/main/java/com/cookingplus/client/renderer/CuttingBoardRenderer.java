package com.cookingplus.client.renderer;

import com.cookingplus.blockentity.CuttingBoardBlockEntity;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.block.model.ItemTransforms;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.client.renderer.blockentity.BlockEntityRendererProvider;
import net.minecraft.client.renderer.entity.ItemRenderer;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

/**
 * Renders the stored ingredient as a 3D item floating just above the
 * cutting board surface, similar to how a campfire shows what's cooking.
 */
public class CuttingBoardRenderer implements BlockEntityRenderer<CuttingBoardBlockEntity> {

    public CuttingBoardRenderer(BlockEntityRendererProvider.Context ctx) {}

    @Override
    public void render(CuttingBoardBlockEntity be, float partialTick, PoseStack pose,
                       MultiBufferSource buffers, int light, int overlay) {
        ItemStack stack = be.getStored();
        if (stack.isEmpty()) return;

        Minecraft mc = Minecraft.getInstance();
        ItemRenderer ir = mc.getItemRenderer();
        Level level = be.getLevel();

        pose.pushPose();
        pose.translate(0.5, 0.135, 0.5); // sit on top of the 2-pixel-tall board
        // Lay the item flat on the board surface
        pose.mulPose(com.mojang.math.Axis.XP.rotationDegrees(90.0f));
        // Slight visual tweak as cutting progresses: more chops = smaller item
        float scale = 0.5f - 0.06f * Math.min(be.getChopProgress(), 4);
        pose.scale(scale, scale, scale);

        ir.renderStatic(stack, ItemDisplayContext.FIXED, light, overlay, pose, buffers, level, 0);
        pose.popPose();
    }
}
