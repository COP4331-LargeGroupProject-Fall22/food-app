import IFood from "../food/IFood";

/**
 * Instruction interface.
 */
export default interface IInstruction {
    /**
     * Single instruction describing step in creating meal.
     */
    readonly instructions: string;

    /**
     * Ingredients store all required food items that are needed for instruction.
     */
    readonly ingredients: IFood[];
}
