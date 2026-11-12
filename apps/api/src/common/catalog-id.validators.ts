import {
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from "class-validator";
import { isCatalogCreatureId, isCatalogHuntId } from "./catalog-ids";

@ValidatorConstraint({ name: "IsCatalogCreatureId", async: false })
class IsCatalogCreatureIdConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (Array.isArray(value)) {
      return value.every((entry) => typeof entry === "string" && isCatalogCreatureId(entry));
    }
    return typeof value === "string" && isCatalogCreatureId(value);
  }

  defaultMessage() {
    return "must be a valid catalog creature id";
  }
}

@ValidatorConstraint({ name: "IsCatalogHuntId", async: false })
class IsCatalogHuntIdConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === "string" && isCatalogHuntId(value);
  }

  defaultMessage() {
    return "must be a valid catalog hunt id";
  }
}

export function IsCatalogCreatureId(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCatalogCreatureIdConstraint,
    });
  };
}

export function IsCatalogHuntId(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCatalogHuntIdConstraint,
    });
  };
}
