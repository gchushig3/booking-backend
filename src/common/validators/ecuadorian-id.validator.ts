import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function isValidEcuadorianId(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24 || Number(value[2]) >= 6) return false;
  const sum = [...value.slice(0, 9)].reduce((total, digit, index) => {
    const product = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}

export function IsEcuadorianId(options?: ValidationOptions) {
  return (object: object, propertyName: string) => registerDecorator({
    name: 'isEcuadorianId', target: object.constructor, propertyName, options,
    validator: { validate(value: unknown) { return typeof value === 'string' && isValidEcuadorianId(value); },
      defaultMessage(args: ValidationArguments) { return `${args.property} must be a valid Ecuadorian identity number`; } },
  });
}
