import IIngredient from "../food/IIngredient";
import IInventoryIngredient from "../food/IInventoryIngredient";
import IShoppingIngredient from "../food/IShoppingIngredient";
import IBaseRecipe from "../recipe/IBaseRecipe";
import IBaseUser from "./IBaseUser";
import IContactInformation from "./IContactInformation";
import ICredentials from "./ICredentials";

export default interface IUser extends IBaseUser, ICredentials, IContactInformation {
    inventory: IInventoryIngredient[];
    
    shoppingList: IShoppingIngredient[];

    favoriteRecipes?: IBaseRecipe[];
}
