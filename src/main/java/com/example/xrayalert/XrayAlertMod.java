package com.example.xrayalert;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.HoverEvent;
import net.minecraft.text.MutableText;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Set;

public class XrayAlertMod implements ModInitializer {
    public static final String MOD_ID = "xrayalert";
    private static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    // Permission level required to receive alerts. Vanilla op level >= 2 can /tp,
    // which matches the click action we attach to coordinates.
    private static final int ALERT_PERMISSION_LEVEL = 2;

    private static final Set<Block> WATCHED_BLOCKS = Set.of(
            Blocks.COAL_ORE,
            Blocks.DEEPSLATE_COAL_ORE,
            Blocks.IRON_ORE,
            Blocks.DEEPSLATE_IRON_ORE,
            Blocks.COPPER_ORE,
            Blocks.DEEPSLATE_COPPER_ORE,
            Blocks.GOLD_ORE,
            Blocks.DEEPSLATE_GOLD_ORE,
            Blocks.NETHER_GOLD_ORE,
            Blocks.REDSTONE_ORE,
            Blocks.DEEPSLATE_REDSTONE_ORE,
            Blocks.LAPIS_ORE,
            Blocks.DEEPSLATE_LAPIS_ORE,
            Blocks.DIAMOND_ORE,
            Blocks.DEEPSLATE_DIAMOND_ORE,
            Blocks.EMERALD_ORE,
            Blocks.DEEPSLATE_EMERALD_ORE,
            Blocks.NETHER_QUARTZ_ORE,
            Blocks.ANCIENT_DEBRIS
    );

    @Override
    public void onInitialize() {
        PlayerBlockBreakEvents.AFTER.register((world, player, pos, state, blockEntity) -> {
            if (world.isClient()) return;
            if (!(player instanceof ServerPlayerEntity serverPlayer)) return;
            Block block = state.getBlock();
            if (!WATCHED_BLOCKS.contains(block)) return;
            broadcastAlert(serverPlayer, block, pos);
        });
        LOGGER.info("X-Ray Alert initialized; watching {} block types.", WATCHED_BLOCKS.size());
    }

    private void broadcastAlert(ServerPlayerEntity breaker, Block block, BlockPos pos) {
        MinecraftServer server = breaker.getServer();
        if (server == null) return;

        String dimensionId = breaker.getWorld().getRegistryKey().getValue().toString();
        String tpCommand = String.format(
                "/execute in %s run tp @s %d %d %d",
                dimensionId, pos.getX(), pos.getY(), pos.getZ()
        );
        String coords = String.format("(%d, %d, %d)", pos.getX(), pos.getY(), pos.getZ());

        MutableText alert = Text.literal("[XrayAlert] ")
                .formatted(Formatting.GOLD, Formatting.BOLD)
                .append(Text.literal(breaker.getName().getString()).formatted(Formatting.YELLOW))
                .append(Text.literal(" mined ").formatted(Formatting.WHITE))
                .append(block.getName().copy().formatted(Formatting.AQUA))
                .append(Text.literal(" at ").formatted(Formatting.WHITE))
                .append(Text.literal(coords).setStyle(Style.EMPTY
                        .withColor(Formatting.GREEN)
                        .withClickEvent(new ClickEvent(ClickEvent.Action.SUGGEST_COMMAND, tpCommand))
                        .withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT,
                                Text.literal("Click to fill teleport command")))))
                .append(Text.literal(" in ").formatted(Formatting.WHITE))
                .append(Text.literal(dimensionId).formatted(Formatting.LIGHT_PURPLE));

        for (ServerPlayerEntity recipient : server.getPlayerManager().getPlayerList()) {
            if (recipient.hasPermissionLevel(ALERT_PERMISSION_LEVEL)) {
                recipient.sendMessage(alert, false);
            }
        }

        LOGGER.info("[XrayAlert] {} mined {} at {} {},{},{}",
                breaker.getName().getString(),
                block.getName().getString(),
                dimensionId, pos.getX(), pos.getY(), pos.getZ());
    }
}
