/**
 * APNA Check — On-Device Scam & Phishing Detection Engine
 * 100% Client-side. Evaluates message requests and incoming text against known
 * Indian and global cyber fraud patterns without sending content to any server.
 */

export interface ScamCheckResult {
  isSuspicious: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reasons: string[];
  warningChip: string | null;
}

const SUSPICIOUS_PATTERNS = [
  {
    regex: /(electricity|bijli)\b.*(bill|cut|disconnect|power off)/i,
    reason: 'Fake electricity bill disconnection alert',
    level: 'high' as const,
  },
  {
    regex: /(bank\s*account|sbi|hdfc|icici|pnb)\b.*(blocked|suspended|kyc|pan\s*card\s*update)/i,
    reason: 'Banking KYC / account suspension phishing',
    level: 'high' as const,
  },
  {
    regex: /(share|send|tell)\s*(the\s*)?(otp|one\s*time\s*password|pin|cvv)/i,
    reason: 'OTP or payment PIN harvesting attempt',
    level: 'high' as const,
  },
  {
    regex: /(install|download)\s*(anydesk|teamviewer|rustdesk|quicksupport|\.apk)/i,
    reason: 'Remote access tool / rogue APK installation request',
    level: 'high' as const,
  },
  {
    regex: /(part[-\s]?time\s*job|earn\s*(rs\.?|₹)?\s*\d{3,5}\s*(per\s*day|daily)|like\s*youtube\s*videos)/i,
    reason: 'Prevalent work-from-home / task scam pattern',
    level: 'high' as const,
  },
  {
    regex: /(won|winner|lottery|lucky\s*draw|crorepati|kaun\s*banega)\s*.*(claim|prize|lakh)/i,
    reason: 'Lottery / prize claim fraud',
    level: 'high' as const,
  },
  {
    regex: /(free\s*crypto|airdrop|binance\s*giveaway|double\s*your\s*money|guaranteed\s*return)/i,
    reason: 'Unregistered crypto or investment scheme',
    level: 'medium' as const,
  },
  {
    regex: /(bit\.ly|tinyurl\.com|t\.me|wa\.me|cutt\.ly|goo\.gl|rb\.gy)\//i,
    reason: 'Shortened or disguised redirect link',
    level: 'medium' as const,
  },
  {
    regex: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
    reason: 'Raw IP address URL (common in malicious payloads)',
    level: 'high' as const,
  },
];

export function runApnaCheck(text: string): ScamCheckResult {
  if (!text || typeof text !== 'string') {
    return { isSuspicious: false, riskLevel: 'none', reasons: [], warningChip: null };
  }

  const reasons: string[] = [];
  let highestLevel: 'none' | 'low' | 'medium' | 'high' = 'none';

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.regex.test(text)) {
      reasons.push(pattern.reason);
      if (pattern.level === 'high') {
        highestLevel = 'high';
      } else if (pattern.level === 'medium' && highestLevel !== 'high') {
        highestLevel = 'medium';
      }
    }
  }

  // Check generic URL presence in unaccepted request
  if (reasons.length === 0 && /https?:\/\//i.test(text)) {
    reasons.push('Contains external links from an unknown sender');
    highestLevel = 'low';
  }

  const isSuspicious = reasons.length > 0;
  let warningChip: string | null = null;

  if (highestLevel === 'high') {
    warningChip = 'Looks suspicious · Potential scam';
  } else if (highestLevel === 'medium') {
    warningChip = 'Caution · Unverified link or offer';
  } else if (highestLevel === 'low') {
    warningChip = 'Contains external link';
  }

  return {
    isSuspicious,
    riskLevel: highestLevel,
    reasons,
    warningChip,
  };
}
