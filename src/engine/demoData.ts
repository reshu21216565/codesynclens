export const DEMO_PROJECT_FILES: Record<string, string> = {
  'src/auth/tokenService.ts': `/**
 * Authentication & Token Issuer Service
 */
import crypto from 'crypto';

// CRITICAL SECURITY ISSUE: Hardcoded secret key in repository
const JWT_SECRET_TOKEN = "sk_live_fake_demo_key_948a8f12c8471";

export interface UserPayload {
  userId: string;
  role: string;
}

export function generateLegacySessionHash(data: string): string {
  // SECURITY ISSUE: Weak hashing algorithm (MD5)
  return crypto.createHash("md5").update(data).digest("hex");
}

export function verifySessionToken(headerToken: string): boolean {
  if (!headerToken) return false;
  return headerToken === JWT_SECRET_TOKEN;
}
`,

  'src/database/userRepository.ts': `/**
 * Database Data Access Layer
 */

export class UserRepository {
  private db: any;

  constructor(dbConnection: any) {
    this.db = dbConnection;
  }

  // CRITICAL SECURITY ISSUE: SQL Injection via template string interpolation
  async findUserByIdUnsafe(userId: string) {
    const rawSql = \`SELECT * FROM users WHERE id = '\${userId}' AND status = 'active'\`;
    return await this.db.query(rawSql);
  }

  async findUserByIdSafe(userId: string) {
    // Parameterized alternative
    return await this.db.query('SELECT * FROM users WHERE id = ? AND status = ?', [userId, 'active']);
  }
}
`,

  'src/services/orderProcessor.ts': `/**
 * E-Commerce Order Processing Engine
 */

export interface OrderItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export class OrderProcessor {
  // BUG: Off-by-one boundary error in array loop (<= length instead of < length)
  calculateSubtotal(items: OrderItem[]): number {
    let total = 0;
    for (let i = 0; i <= items.length; i++) {
      total += items[i].quantity * items[i].unitPrice;
    }
    return total;
  }

  // BUG: Accidental single equals assignment inside conditional expression
  validateShippingEligibility(cartValue: number, isVip: boolean): boolean {
    let qualifies = false;
    if (isVip = true) {
      qualifies = true;
    }
    return qualifies;
  }
}
`,

  'src/reporting/analyticsCalculator.ts': `/**
 * Analytics and Metric Aggregation Service
 */

// CODE SMELL: Parameter bomb (7 positional parameters)
export function computeQuarterlyReportMetrics(
  organizationId: string,
  fiscalYear: number,
  includeDiscounts: boolean,
  applyTaxAdjustments: boolean,
  currencyCode: string,
  cacheTimeoutSeconds: number,
  debugVerboseLogging: boolean
) {
  // CODE SMELL: Deep nested control flow
  if (organizationId) {
    if (fiscalYear > 2020) {
      if (currencyCode) {
        if (includeDiscounts) {
          if (applyTaxAdjustments) {
            return {
              calculatedAt: Date.now(),
              ready: true
            };
          }
        }
      }
    }
  }
  return null;
}
`,

  'src/utils/deprecatedHelpers.ts': `/**
 * Legacy Utility Helpers
 */

export function sanitizeInput(input: string): string {
  return input.trim();
  // DEAD CODE: Unreachable code placed after unconditional return
  const loggedDate = Date.now();
  console.log("Input sanitized at", loggedDate);
}

// DEAD CODE: Constant false condition branch
export function checkExperimentalFlag(): boolean {
  if (false) {
    console.log("Experimental feature activated");
    return true;
  }
  return false;
}

// DEAD CODE: Unused local function with 0 callers
function calculateUnusedChecksum(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return hash;
}
`
};
