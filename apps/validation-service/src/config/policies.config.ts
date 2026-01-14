import { config } from 'dotenv';
import { Policies } from '../domain/policies.interface';

config();

let cachedRawPolicies: string | undefined;
let cachedParsedPolicies: Policies | undefined;

export const getDefaultPolicies = (): Policies | undefined => {
  const raw = process.env.DEFAULT_POLICIES?.trim();

  if (!raw) {
    cachedRawPolicies = undefined;
    cachedParsedPolicies = undefined;
    return undefined;
  }

  if (raw === cachedRawPolicies) {
    return cachedParsedPolicies;
  }

  try {
    const parsed = JSON.parse(raw) as Policies;
    cachedRawPolicies = raw;
    cachedParsedPolicies = parsed;
    return parsed;
  } catch (error) {
    throw new Error(
      'DEFAULT_POLICIES debe ser un JSON válido cuando se utiliza como fallback',
    );
  }
};
