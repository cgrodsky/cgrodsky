package com.cgrodsky.adminessentials.state;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.scores.PlayerTeam;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.scores.Team;

public final class TeamManager {
    public static final String VANISH_TEAM = "ae_vanished";
    public static final String MORPH_TEAM  = "ae_morphed";

    private TeamManager() {}

    public static void ensureTeams(MinecraftServer server) {
        Scoreboard sb = server.getScoreboard();
        ensure(sb, VANISH_TEAM, Component.literal("[V] ").withStyle(ChatFormatting.GRAY));
        ensure(sb, MORPH_TEAM,  Component.literal("[M] ").withStyle(ChatFormatting.AQUA));
    }

    private static void ensure(Scoreboard sb, String name, Component prefix) {
        PlayerTeam team = sb.getPlayerTeam(name);
        if (team == null) team = sb.addPlayerTeam(name);
        team.setPlayerPrefix(prefix);
        team.setNameTagVisibility(Team.Visibility.ALWAYS);
        team.setSeeFriendlyInvisibles(true);
    }

    public static void addToTeam(MinecraftServer server, String teamName, String playerName) {
        Scoreboard sb = server.getScoreboard();
        PlayerTeam team = sb.getPlayerTeam(teamName);
        if (team == null) return;
        sb.addPlayerToTeam(playerName, team);
    }

    public static void removeFromTeam(MinecraftServer server, String teamName, String playerName) {
        Scoreboard sb = server.getScoreboard();
        PlayerTeam team = sb.getPlayerTeam(teamName);
        if (team == null) return;
        if (team.getPlayers().contains(playerName)) {
            sb.removePlayerFromTeam(playerName, team);
        }
    }
}
