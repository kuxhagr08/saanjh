import { describe, it, expect } from 'vitest';
import { APP_NAME, APP_TAGLINE, APP_DEFAULT_ABOUT, APP_DOMAIN } from '../constants';

describe('A1: Single App Name Standardisation', () => {
  it('defines the centralized APP_NAME constant as Saanjh', () => {
    expect(APP_NAME).toBe('Saanjh');
    expect(APP_TAGLINE).toBe('Your Life. Your Space.');
    expect(APP_DEFAULT_ABOUT).toContain('Saanjh');
    expect(APP_DOMAIN).toBe('saanjh.local');
  });

  it('guarantees that default status copy is branded with Saanjh', () => {
    expect(APP_DEFAULT_ABOUT).toBe('Hey there! I am using Saanjh.');
  });
});

