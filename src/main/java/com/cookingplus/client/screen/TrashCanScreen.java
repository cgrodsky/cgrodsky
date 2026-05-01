package com.cookingplus.client.screen;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.menu.TrashCanMenu;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.player.Inventory;

public class TrashCanScreen extends AbstractContainerScreen<TrashCanMenu> {
    private static final ResourceLocation TEXTURE =
            new ResourceLocation(CookingPlusMod.MODID, "textures/gui/trash_can.png");

    public TrashCanScreen(TrashCanMenu menu, Inventory inv, Component title) {
        super(menu, inv, title);
        this.imageWidth = 176;
        this.imageHeight = 166;
        this.inventoryLabelY = this.imageHeight - 94;
    }

    @Override
    protected void init() {
        super.init();
        int btnW = 80;
        int btnH = 16;
        int btnX = leftPos + (imageWidth - btnW) / 2;
        int btnY = topPos - btnH - 4;
        addRenderableWidget(Button.builder(
                Component.translatable("button.cookingplus.empty_trash"),
                b -> {
                    if (Minecraft.getInstance().gameMode != null) {
                        Minecraft.getInstance().gameMode.handleInventoryButtonClick(menu.containerId, TrashCanMenu.EMPTY_TRASH_BUTTON);
                    }
                }
        ).bounds(btnX, btnY, btnW, btnH).build());
    }

    @Override
    protected void renderBg(GuiGraphics g, float partialTick, int mouseX, int mouseY) {
        RenderSystem.setShader(net.minecraft.client.renderer.GameRenderer::getPositionTexShader);
        RenderSystem.setShaderColor(1f, 1f, 1f, 1f);
        int x = (this.width - imageWidth) / 2;
        int y = (this.height - imageHeight) / 2;
        g.blit(TEXTURE, x, y, 0, 0, imageWidth, imageHeight);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        renderBackground(g);
        super.render(g, mouseX, mouseY, partialTick);
        renderTooltip(g, mouseX, mouseY);
    }
}
