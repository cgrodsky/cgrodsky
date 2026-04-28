package com.cgrodsky.adminessentials.commands;

import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

public class CommandRegistry {
    @SubscribeEvent
    public void onRegisterCommands(RegisterCommandsEvent event) {
        SudoCommand.register(event.getDispatcher());
        AdminChatCommand.register(event.getDispatcher());
    }
}
