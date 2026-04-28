package com.cgrodsky.adminessentials;

import com.cgrodsky.adminessentials.alerts.XrayAlertListener;
import com.cgrodsky.adminessentials.commands.CommandRegistry;
import com.mojang.logging.LogUtils;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.slf4j.Logger;

@Mod(AdminEssentials.MODID)
public class AdminEssentials {
    public static final String MODID = "adminessentials";
    public static final Logger LOGGER = LogUtils.getLogger();

    public AdminEssentials() {
        IEventBus modBus = FMLJavaModLoadingContext.get().getModEventBus();
        modBus.addListener(Permissions::onGather);

        MinecraftForge.EVENT_BUS.register(new CommandRegistry());
        MinecraftForge.EVENT_BUS.register(new XrayAlertListener());

        LOGGER.info("Admin Essentials loaded");
    }
}
