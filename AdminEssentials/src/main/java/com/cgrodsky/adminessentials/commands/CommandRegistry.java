package com.cgrodsky.adminessentials.commands;

import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

public class CommandRegistry {
    @SubscribeEvent
    public void onRegisterCommands(RegisterCommandsEvent event) {
        SudoCommand.register(event.getDispatcher());
        AdminChatCommand.register(event.getDispatcher());
        VanishCommand.register(event.getDispatcher());
        XrayCommand.register(event.getDispatcher());
        AdminTpCommand.register(event.getDispatcher());
        HealCommand.register(event.getDispatcher());
        FeedCommand.register(event.getDispatcher());
        GodCommand.register(event.getDispatcher());
        FlyCommand.register(event.getDispatcher());
        SpeedCommand.register(event.getDispatcher());
        HomeCommand.register(event.getDispatcher());
        WarpCommand.register(event.getDispatcher());
        BackCommand.register(event.getDispatcher());
        MorphCommand.register(event.getDispatcher());
        SpawnCommand.register(event.getDispatcher());
        RoleCommand.register(event.getDispatcher());
    }
}
