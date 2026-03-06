export const SafetyLevel = {
  SAFE: "safe",
  MODERATE: "moderate",
  DANGEROUS: "dangerous",
};

/**
 * Tool interface:
 * {
 *   definition: {
 *     name: string,
 *     description: string,
 *     parameters: { type: "object", properties: {...}, required: string[] }
 *   },
 *   safetyLevel: SafetyLevel,
 *   validate(args, context) -> { ok: boolean, error?: string },
 *   execute(args, context) -> Promise<string>,
 *   formatConfirmation(args) -> string,
 * }
 *
 * context: {
 *   projectRoot: string,
 *   config: object,
 *   ui: UIHelper,
 *   signal: AbortSignal,
 * }
 */
