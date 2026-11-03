import { describe, it, expect } from 'vitest';
import { runApnaCheck } from '../utils/apnaCheck';
import {
  computeSafetyNumber,
  encryptMessageForRecipient,
  decryptMessageFromSender,
  generateIdentityKeys,
} from '../utils/crypto';

describe('APNA Check On-Device Scam & Fraud Scanner', () => {
  it('detects high-risk electricity bill disconnection scams', () => {
    const text = 'Dear user, your electricity bill is unpaid. Power will be disconnected tonight. Call 9876543210.';
    const res = runApnaCheck(text);
    expect(res.isSuspicious).toBe(true);
    expect(res.riskLevel).toBe('high');
    expect(res.warningChip).toContain('suspicious');
  });

  it('detects banking KYC / PAN account suspension phishing', () => {
    const text = 'Your SBI bank account is suspended due to pending KYC. Click link to update pan card.';
    const res = runApnaCheck(text);
    expect(res.isSuspicious).toBe(true);
    expect(res.riskLevel).toBe('high');
  });

  it('detects OTP and PIN harvesting attempts', () => {
    const text = 'Please share the OTP you just received to verify your refund.';
    const res = runApnaCheck(text);
    expect(res.isSuspicious).toBe(true);
    expect(res.reasons.some((r) => r.includes('OTP'))).toBe(true);
  });

  it('detects remote access tool APK requests', () => {
    const text = 'Install Anydesk app to receive tech support assistance.';
    const res = runApnaCheck(text);
    expect(res.isSuspicious).toBe(true);
    expect(res.riskLevel).toBe('high');
  });

  it('detects work-from-home task scams', () => {
    const text = 'Part time job earn Rs 5000 daily just by liking youtube videos.';
    const res = runApnaCheck(text);
    expect(res.isSuspicious).toBe(true);
  });

  it('detects shortened redirect URLs', () => {
    const text = 'Check out this photo: bit.ly/3xYz8q';
    const res = runApnaCheck(text);
    expect(res.isSuspicious).toBe(true);
    expect(res.riskLevel).toBe('medium');
  });

  it('passes benign conversational text without warnings', () => {
    const text = 'Hi Kushagra, let me know when you are free to discuss the project design.';
    const res = runApnaCheck(text);
    expect(res.isSuspicious).toBe(false);
    expect(res.riskLevel).toBe('none');
    expect(res.warningChip).toBeNull();
  });
});

describe('Libsodium E2E Encryption Primitives', () => {
  it('computes deterministic 60-digit safety numbers in 12 blocks', async () => {
    const pubA = 'uK3eA9+yF2Q5Kx7XkG5eR9pQ1oZ8mV3nB2vC1aD0eF=';
    const pubB = 'bL4fB0+zG3R6Ly8YlH6fS0qR2pa9nW4oC3wD2bE1fG=';

    const num1 = await computeSafetyNumber(pubA, pubB);
    const num2 = await computeSafetyNumber(pubB, pubA);

    // Symmetric / independent of order
    expect(num1).toBe(num2);

    // 12 blocks of 5 digits separated by spaces
    const blocks = num1.split(' ');
    expect(blocks.length).toBe(12);
    blocks.forEach((b) => {
      expect(b).toMatch(/^\d{5}$/);
    });
  });

  it('encrypts with 64-byte padding and decrypts cleanly', async () => {
    const alice = await generateIdentityKeys();
    const bob = await generateIdentityKeys();

    const plaintext = 'Secret message with exact privacy verification.';
    const encrypted = await encryptMessageForRecipient(
      plaintext,
      bob.publicKeyBase64,
      alice.privateKeyBase64
    );

    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.nonce).toBeTruthy();

    const decrypted = await decryptMessageFromSender(
      encrypted.ciphertext,
      encrypted.nonce,
      alice.publicKeyBase64,
      bob.privateKeyBase64
    );

    expect(decrypted).toBe(plaintext);
  });
});
