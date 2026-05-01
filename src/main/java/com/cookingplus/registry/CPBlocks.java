package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.block.CuttingBoardBlock;
import com.cookingplus.block.OvenBlock;
import com.cookingplus.block.TrashCanBlock;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

import java.util.function.Supplier;

public final class CPBlocks {
    public static final DeferredRegister<Block> BLOCKS =
            DeferredRegister.create(ForgeRegistries.BLOCKS, CookingPlusMod.MODID);

    public static final RegistryObject<Block> OVEN = registerBlock(
            "oven",
            () -> new OvenBlock(BlockBehaviour.Properties.of()
                    .mapColor(MapColor.METAL)
                    .strength(3.5f)
                    .sound(SoundType.METAL)
                    .lightLevel(state -> state.getValue(OvenBlock.LIT) ? 13 : 0))
    );

    public static final RegistryObject<Block> TRASH_CAN = registerBlock(
            "trash_can",
            () -> new TrashCanBlock(BlockBehaviour.Properties.of()
                    .mapColor(MapColor.METAL)
                    .strength(2.0f)
                    .sound(SoundType.METAL))
    );

    public static final RegistryObject<Block> CUTTING_BOARD = registerBlock(
            "cutting_board",
            () -> new CuttingBoardBlock(BlockBehaviour.Properties.of()
                    .mapColor(MapColor.WOOD)
                    .strength(1.5f)
                    .sound(SoundType.WOOD)
                    .noOcclusion())
    );

    private static <T extends Block> RegistryObject<T> registerBlock(String name, Supplier<T> blockSup) {
        RegistryObject<T> reg = BLOCKS.register(name, blockSup);
        CPItems.ITEMS.register(name, () -> new BlockItem(reg.get(), new Item.Properties()));
        return reg;
    }

    private CPBlocks() {}
}
