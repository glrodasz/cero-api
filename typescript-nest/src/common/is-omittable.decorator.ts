import { ValidateIf } from "class-validator";

/**
 * Skips the field's other validators when it is absent. Unlike `@IsOptional()`,
 * which also lets `null` through, an explicit `null` is still validated (and
 * refused), as the contract asks for fields that cannot be null.
 */
export const IsOmittable = (): PropertyDecorator => ValidateIf((_object, value) => value !== undefined);
