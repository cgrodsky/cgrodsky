package com.cgrodsky.adminessentials;

import com.cgrodsky.adminessentials.alerts.XrayAlertListener;
import com.cgrodsky.adminessentials.commands.CommandRegistry;
import com.cgrodsky.adminessentials.events.GodListener;
import com.cgrodsky.adminessentials.events.PlayerEvents;
import com.cgrodsky.adminessentials.events.ProtectionListener;
import com.cgrodsky.adminessentials.state.MorphManager;
import com.cgrodsky.adminessentials.state.RoleManager;
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

        IEventBus forgeBus = MinecraftForge.EVENT_BUS;
        forgeBus.register(new CommandRegistry());
        forgeBus.register(new XrayAlertListener());
        forgeBus.register(new PlayerEvents());
        forgeBus.register(new ProtectionListener());
        forgeBus.register(new GodListener());
        forgeBus.register(new MorphManager());
        forgeBus.register(new RoleManager());

        LOGGER.info("Admin Essentials loaded");
    }
}
