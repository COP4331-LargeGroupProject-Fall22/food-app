import axios from 'axios';
import * as dotenv from 'dotenv';
import { exit } from 'process';
import { URLSearchParams } from 'url';
import IncorrectIDFormat from '../../exceptions/IncorrectIDFormat';
import NoParameterFound from '../../exceptions/NoParameterFound';
import ParameterIsNotAllowed from '../../exceptions/ParameterIsNotAllowed';
import IFoodAPI from '../../foodAPI/IFoodAPI';
import IFood from '../../serverAPI/model/food/IFood';
import IInstruction from '../../serverAPI/model/instruction/IInstruction';
dotenv.config();

import IRecipe from "../../serverAPI/model/recipe/IRecipe";
import IRecipeAPI from "../IRecipeAPI";

export default class SpoonacularRecipeAPI implements IRecipeAPI {
    protected foodAPI: IFoodAPI;

    protected apiKey: string;
    protected host: string;

    protected recipeSearchParameters: Set<string>;
    protected recipeGetParameters: Set<string>;

    protected dishTypes: Set<string>;

    protected headers: any;

    constructor(foodAPI: IFoodAPI) {
        this.foodAPI = foodAPI;

        this.apiKey = process.env.SPOONACULAR_API_KEY;
        this.host = process.env.SPOONACULAR_HOST;

        this.headers = {
            "X-RapidAPI-Key": this.apiKey,
            "X-RapidAPI-Host": this.host
        },

            this.dishTypes = new Set([
                "main course",
                "side dish",
                "dessert",
                "appetizer",
                "salad",
                "bread",
                "breakfast",
                "soup",
                "beverage",
                "sauce",
                "drink"
            ]);

        this.recipeSearchParameters = new Set([
            'query',
            'cuisine',
            'diet',
            'intolerences',
            'includeIngredients',
            'type'
        ]);

        this.recipeGetParameters = new Set([

        ]);
    }

    /**
     * Retrieves collection of partially filled Recipe items that satisfy searching parameters.
     * 
     * @param parameters parameters used for searching.
     * - query - required parameter that defines the name of the Recipe item (partial names are accepted).
     * - number - optional parameter that defines max number of the results to be returned.
     * - page - optional parameter that defines page number for pagination.
     * - intolerence - optional parameter that defines the type of intolerences to be taken in consideration during searching.
     * - cuisine - optional parameter that limits search results to specific cuisines.
     * - type - optional parameter that limits search results to specific dish types.
     * 
     * @throws NoParameterFound exception when required parameters weren't found.
     * @throws ParameterIsNotAllowed exception when encountering a non-existing parameter.
     * 
     * @returns Promise filled with a collection of Partial<IRecipe> objects.
     */
    async SearchRecipe(parameters: Map<string, any>): Promise<Partial<IRecipe>[]> {
        let searchRecipeURL = process.env.SPOONACULAR_RECIPE_BASE_URL + '/complexSearch';

        let urlSearchParameters = this.convertSearchRecipeParameters(parameters);

        let response = await axios(
            searchRecipeURL,
            {
                headers: this.headers,
                params: urlSearchParameters
            }
        );

        let jsonArray: any[] = response.data.results;
        let recipeArray: IRecipe[] = [];

        for (let i = 0; i < jsonArray.length; i++) {
            recipeArray.push(
                await this.parseRecipe(jsonArray[i])
            );
        }

        return recipeArray;
    }

    /**
     * Converts search recipe parameters to URLSearchParams.
     * 
     * @param parameters parameters used for searching.
     * - query - required parameter that defines the name of the Recipe item (partial names are accepted).
     * - number - optional parameter that defines max number of the results to be returned.
     * - page - optional parameter that defines page number for pagination.
     * - intolerence - optional parameter that defines the type of intolerences to be taken in consideration during searching.
     * - cuisine - optional parameter that limits search results to specific cuisines.
     * - type - optional parameter that limits search results to specific dish types.
     * 
     * @throws NoParameterFound exception when required parameters weren't found.
     * @throws ParameterIsNotAllowed exception when encountering a non-existing parameter.
     * @returns 
     */
    protected convertSearchRecipeParameters(parameters: Map<string, any>): URLSearchParams {
        let keys = Array.from(parameters.keys());

        let searchParameters = new URLSearchParams();

        if (!parameters.has("query")) {
            throw new NoParameterFound("Query parameter is missing.");
        }

        keys.forEach(key => {
            if (this.recipeSearchParameters.has(String(key))) {
                if (key === "page") {
                    searchParameters.append("offset", String(parameters.get(key)));
                } else {
                    searchParameters.append(key, String(parameters.get(key)));
                }
            }
            else {
                throw new ParameterIsNotAllowed(`Query parameter is not allowed ${key}`);
            }
        });

        searchParameters.append("instructionRequired", "true");
        searchParameters.append("addRecipeInformation", "true");

        return searchParameters;
    }

    protected async parseRecipe(recipeObject: any): Promise<IRecipe> {
        let types: string = this.parseDishTypes(recipeObject.dishTypes);

        let instructionSteps: IInstruction[] = await this.parseInstructionSteps(recipeObject);

        let instruction: IInstruction = await this.combineInstructionSteps(instructionSteps);

        return {
            id: recipeObject.id,
            name: recipeObject.title,
            cuisines: recipeObject.cuisines,
            diets: recipeObject.diets,
            type: types,
            instruction: instruction,
            instructionSteps: instructionSteps,
            servings: recipeObject.servings,
            preparationInMinutes: recipeObject.preparationMinutes,
            cookingTimeInMinutes: recipeObject.readyInMinutes,
            totalCost: recipeObject.pricePerServing * recipeObject.servings
        }
    }


    protected async parseInstructionSteps(recipeObject: any): Promise<IInstruction[]> {
        let instructons: any[] = recipeObject.analyzedInstructions[0].steps;

        let instructionSteps: IInstruction[] = [];

        for (let i = 0; i < instructons.length; i++) {
            let ingredients: any[] = instructons[i].ingredients;
            let parsedIngredients: IFood[] = [];

            for (let j = 0; j < ingredients.length; j++) {
                let parsedIngredient = await this.parseIngredient(ingredients[j]);
                parsedIngredients.push(parsedIngredient);
            }

            instructionSteps.push({
                instructions: instructons[i].step,
                ingredients: parsedIngredients
            });
        }

        return instructionSteps;
    }

    private calculateFoodHash(food: IFood): string {
        return "#" + String(food.id) + "#" + food.name + "#" + food.category + "#" + String(food.nutrients);
    }

    protected async combineInstructionSteps(instructionSteps: IInstruction[]): Promise<IInstruction> {
        let ingredientsMap: Map<string, IFood> = new Map();
        let instrucions: string = "";

        for (let i = 0; i < instructionSteps.length; i++) {
            let ingredients = instructionSteps[i].ingredients;
            instrucions += instructionSteps[i].instructions + " ";

            for (let j = 0; j < ingredients.length; j++) {
                let foodHash = this.calculateFoodHash(ingredients[j]);

                if (!ingredientsMap.has(foodHash)) {
                    ingredientsMap.set(foodHash, ingredients[j]);
                }
            }
        }

        instrucions = instrucions.slice(0, instrucions.length - 1);

        return {
            instructions: instrucions,
            ingredients: Array.from(ingredientsMap.values())
        };
    }

    protected async parseIngredient(ingredientObject: any): Promise<IFood> {
        let parsedName = ingredientObject.name !== undefined ? ingredientObject.name : "undefined";
        let parsedID = ingredientObject.id !== undefined ? ingredientObject.id : -1;
        let parsedCategory = ingredientObject.aisle !== undefined ? ingredientObject.aisle : "";

        // Is there any other way to avoid "exception eating"
        // 1 request call to API
        let food: IFood | null;
        try {
            food = await this.foodAPI.GetFood(new Map([["id", parsedID]])); 
        
            if (food !== null) {
                return food;
            }
        } catch (error) {}
        
        return {
            id: parsedID,
            name: parsedName,
            category: parsedCategory,
            nutrients: []
        }
    }

    protected parseDishTypes(recipeDishTypes: string[]): string {
        let types = "";
        recipeDishTypes.forEach((type: string) => {
            if (this.dishTypes.has(type)) {
                types += type + ", ";
            }
        });

        types = types.slice(0, types.length - 2);

        return types;
    }


    /**
     * Retrieves specific Recipe item that is defined by unique identifier.
     * 
     * @param parameters parameters used for searching.
     * - id - required parameter that defines unique identifier of the Recipe item
     * 
     * @throws NoParameterFound exception when required parameters weren't found.
     * @throws IncorrectIDFormat exception when unique identifier has incorrect format.
     * 
     * @returns Promise filled with a IRecipe object or null when Recipe item wasn't found.
     */
    async GetRecipe(parameters: Map<string, any>): Promise<IRecipe | null> {
        if (!parameters.has("id")) {
            throw new NoParameterFound("Required parameter is missing.");
        }

        let recipeID = Number.parseInt(parameters.get("id"));

        if (Number.isNaN(recipeID) || recipeID < 0) {
            throw new IncorrectIDFormat("ID should be a positive integer.");
        }

        let getRecipeURL = `${process.env.SPOONACULAR_RECIPE_BASE_URL}/${recipeID}/information`;

        let response = await axios.get(
            getRecipeURL,
            {
                headers: this.headers
            }
        );

        let jsonObject: any = response.data;
        let parsedRecipe = this.parseRecipe(jsonObject);

        return parsedRecipe;
    }

}