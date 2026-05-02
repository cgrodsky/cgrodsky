package com.cookingplus.client.screen;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.menu.MicrowaveMenu;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.player.Inventory;

public class MicrowaveScreen extends AbstractContainerScreen<MicrowaveMenu> {
    private static final ResourceLocation TEXTURE =
            new ResourceLocation(CookingPlusMod.MODID, "textures/gui/microwave.png");
    private static final int ARROW_X = 79, ARROW_Y = 34;
    private static final int ARROW_WIDTH = 24, ARROW_HEIGHT = 17;

    public MicrowaveScreen(MicrowaveMenu menu, Inventory inv, Component title) {
        super(menu, inv, title);
        this.imageWidth = 176;
        this.imageHeight = 166;
        this.inventoryLabelY = this.imageHeight - 94;
    }

    @Override
    protected void renderBg(GuiGraphics g, float partialTick, int mouseX, int mouseY) {
        RenderSystem.setShader(net.minecraft.client.renderer.GameRenderer::getPositionTexShader);
        RenderSystem.setShaderColor(1f, 1f, 1f, 1f);
        int x = (this.width - imageWidth) / 2;
        int y = (this.height - imageHeight) / 2;
        g.blit(TEXTURE, x, y, 0, 0, imageWidth, imageHeight);
        int progress = menu.getProgressPixels(ARROW_WIDTH);
        if (progress > 0) g.blit(TEXTURE, x + ARROW_X, y + ARROW_Y, 176, 0, progress, ARROW_HEIGHT);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        renderBackground(g);
        super.render(g, mouseX, mouseY, partialTick);
        renderTooltip(g, mouseX, mouseY);
    }
}
