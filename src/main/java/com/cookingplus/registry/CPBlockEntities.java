package com.cookingplus.registry;

import com.cookingplus.CookingPlusMod;
import com.cookingplus.blockentity.CuttingBoardBlockEntity;
import com.cookingplus.blockentity.OvenBlockEntity;
import com.cookingplus.blockentity.TrashCanBlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class CPBlockEntities {
    public static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES =
            DeferredRegister.create(ForgeRegistries.BLOCK_ENTITY_TYPES, CookingPlusMod.MODID);

    public static final RegistryObject<BlockEntityType<OvenBlockEntity>> OVEN =
            BLOCK_ENTITIES.register("oven",
                    () -> BlockEntityType.Builder.of(OvenBlockEntity::new, CPBlocks.OVEN.get()).build(null));

    public static final RegistryObject<BlockEntityType<TrashCanBlockEntity>> TRASH_CAN =
            BLOCK_ENTITIES.register("trash_can",
                    () -> BlockEntityType.Builder.of(TrashCanBlockEntity::new, CPBlocks.TRASH_CAN.get()).build(null));

    public static final RegistryObject<BlockEntityType<CuttingBoardBlockEntity>> CUTTING_BOARD =
            BLOCK_ENTITIES.register("cutting_board",
                    () -> BlockEntityType.Builder.of(CuttingBoardBlockEntity::new, CPBlocks.CUTTING_BOARD.get()).build(null));

    private CPBlockEntities() {}
}
