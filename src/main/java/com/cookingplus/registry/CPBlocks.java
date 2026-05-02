package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.block.CuttingBoardBlock;
import com.cookingplus.block.MicrowaveBlock;
import com.cookingplus.block.OvenBlock;
import com.cookingplus.block.ShapedBlock;
import com.cookingplus.block.SinkBlock;
import com.cookingplus.block.TrashCanBlock;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.DyeColor;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import net.minecraft.world.phys.shapes.Shapes;
import net.minecraft.world.phys.shapes.VoxelShape;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

import java.util.EnumMap;
import java.util.Map;
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

    public static final RegistryObject<Block> MICROWAVE = registerBlock(
            "microwave",
            () -> new MicrowaveBlock(BlockBehaviour.Properties.of()
                    .mapColor(MapColor.METAL)
                    .strength(2.0f)
                    .sound(SoundType.METAL)
                    .noOcclusion()
                    .lightLevel(state -> state.getValue(MicrowaveBlock.LIT) ? 7 : 0))
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

    public static final RegistryObject<Block> SINK = registerBlock(
            "sink",
            () -> new SinkBlock(BlockBehaviour.Properties.of()
                    .mapColor(MapColor.METAL)
                    .strength(1.5f)
                    .sound(SoundType.METAL)
                    .noOcclusion())
    );

    // Decorative furniture
    private static final VoxelShape BOWL_SHAPE  = Shapes.box(0.31, 0.0, 0.31, 0.69, 0.25, 0.69);
    private static final VoxelShape PLATE_SHAPE = Shapes.box(0.10, 0.0, 0.10, 0.90, 0.0625, 0.90);
    private static final VoxelShape TABLE_SHAPE = Shapes.box(0.0, 0.0, 0.0, 1.0, 0.875, 1.0);
    private static final VoxelShape CHAIR_SHAPE = Shapes.box(0.125, 0.0, 0.125, 0.875, 1.0, 0.875);
    private static final VoxelShape CLOTH_SHAPE = Shapes.box(0.0, 0.0, 0.0, 1.0, 0.0625, 1.0);

    private static BlockBehaviour.Properties wood() {
        return BlockBehaviour.Properties.of().mapColor(MapColor.WOOD).strength(1.0f).sound(SoundType.WOOD).noOcclusion();
    }
    private static BlockBehaviour.Properties ceramic() {
        return BlockBehaviour.Properties.of().mapColor(MapColor.SAND).strength(0.5f).sound(SoundType.GLASS).noOcclusion();
    }
    private static BlockBehaviour.Properties woolProps(DyeColor c) {
        return BlockBehaviour.Properties.of().mapColor(c).strength(0.6f).sound(SoundType.WOOL).noOcclusion();
    }

    public static final RegistryObject<Block> BOWL  = registerBlock("bowl",
            () -> new ShapedBlock(ceramic(), BOWL_SHAPE));
    public static final RegistryObject<Block> PLATE = registerBlock("plate",
            () -> new ShapedBlock(ceramic(), PLATE_SHAPE));
    public static final RegistryObject<Block> DINING_TABLE = registerBlock("dining_table",
            () -> new ShapedBlock(wood(), TABLE_SHAPE));
    public static final RegistryObject<Block> DINING_CHAIR = registerBlock("dining_chair",
            () -> new ShapedBlock(wood(), CHAIR_SHAPE));

    // 16-color tablecloth, one block per dye color.
    public static final Map<DyeColor, RegistryObject<Block>> TABLECLOTHS = makeTablecloths();
    private static Map<DyeColor, RegistryObject<Block>> makeTablecloths() {
        Map<DyeColor, RegistryObject<Block>> map = new EnumMap<>(DyeColor.class);
        for (DyeColor c : DyeColor.values()) {
            map.put(c, registerBlock(c.getName() + "_tablecloth",
                    () -> new ShapedBlock(woolProps(c), CLOTH_SHAPE)));
        }
        return map;
    }

    private static <T extends Block> RegistryObject<T> registerBlock(String name, Supplier<T> blockSup) {
        RegistryObject<T> reg = BLOCKS.register(name, blockSup);
        CPItems.ITEMS.register(name, () -> new BlockItem(reg.get(), new Item.Properties()));
        return reg;
    }

    private CPBlocks() {}
}
