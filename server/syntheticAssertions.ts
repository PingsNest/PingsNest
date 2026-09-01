import vm from 'node:vm';

export interface SyntheticAssertionRule {
  type: 'status_code' | 'body_regex' | 'json_path' | 'header_contains';
  target: string; // e.g. "200..299" or "$.status" or "Content-Type"
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  expectedValue: string;
}

export interface AssertionResult {
  passed: boolean;
  ruleSummary: string;
  actualValue?: string;
  error?: string;
}

/**
 * Checks for known catastrophic backtracking patterns (nested quantifiers).
 */
export function isSafeRegexPattern(pattern: string): boolean {
  // Disallow nested quantifiers such as (a+)+, (a|b+)+, (.*a)*, ([a-z]+)+
  if (/(\+|\*|\{\d+,\d*?\})\s*(\+|\*|\{\d+,\d*?\})/.test(pattern)) return false;
  if (/\([^)]*(\+|\*|\{\d+,\d*?\})[^)]*\)\s*(\+|\*|\{\d+,\d*?\})/.test(pattern)) return false;
  return true;
}

/**
 * Runs regex test with strict execution timeout using node:vm sandbox.
 */
export function evaluateRegexSafely(pattern: string, text: string, timeoutMs = 100): { passed: boolean; error?: string } {
  if (!isSafeRegexPattern(pattern)) {
    return { passed: false, error: 'Rejected potentially vulnerable regular expression pattern (nested quantifiers)' };
  }

  // Cap scan buffer at 64KB
  const truncatedText = text.length > 65536 ? text.substring(0, 65536) : text;

  try {
    const sandbox = {
      regex: new RegExp(pattern, 'i'),
      text: truncatedText,
      result: false,
    };
    const context = vm.createContext(sandbox);
    const script = new vm.Script('result = regex.test(text)');
    script.runInContext(context, { timeout: timeoutMs });
    return { passed: sandbox.result };
  } catch (err: any) {
    return { passed: false, error: err.message || 'Regex evaluation failed or timed out' };
  }
}

/**
 * Evaluates synthetic assertion rules against response body, headers, and HTTP status codes.
 */
export function evaluateSyntheticAssertions(
  statusCode: number,
  headers: Record<string, string>,
  bodyText: string,
  assertions: SyntheticAssertionRule[]
): { allPassed: boolean; results: AssertionResult[] } {
  const results: AssertionResult[] = [];
  let allPassed = true;

  if (!assertions || !Array.isArray(assertions) || assertions.length === 0) {
    return { allPassed: true, results: [] };
  }

  let parsedJsonBody: any = null;
  if (bodyText && (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('['))) {
    try { parsedJsonBody = JSON.parse(bodyText); } catch {}
  }

  for (const rule of assertions) {
    let passed = false;
    let actualValue = '';
    let evalError: string | undefined;
    const summary = `${rule.type.toUpperCase()}: ${rule.target} ${rule.operator} "${rule.expectedValue}"`;

    try {
      if (rule.type === 'status_code') {
        actualValue = String(statusCode);
        if (rule.target.includes('..')) {
          const [min, max] = rule.target.split('..').map(Number);
          passed = statusCode >= min && statusCode <= max;
        } else {
          passed = statusCode === Number(rule.expectedValue || rule.target);
        }
      } else if (rule.type === 'body_regex') {
        actualValue = bodyText.length > 100 ? bodyText.substring(0, 100) + '...' : bodyText;
        const evalResult = evaluateRegexSafely(rule.expectedValue, bodyText, 100);
        passed = evalResult.passed;
        if (evalResult.error) {
          evalError = evalResult.error;
        }
      } else if (rule.type === 'header_contains') {
        const headerVal = Object.entries(headers).find(([k]) => k.toLowerCase() === rule.target.toLowerCase())?.[1] || '';
        actualValue = headerVal;
        passed = headerVal.toLowerCase().includes(rule.expectedValue.toLowerCase());
      } else if (rule.type === 'json_path' && parsedJsonBody) {
        // Simple JSON path resolution e.g. $.status or data.status
        const keyPath = rule.target.replace(/^\$\./, '').split('.');
        let val = parsedJsonBody;
        for (const k of keyPath) {
          if (val && typeof val === 'object') val = val[k];
          else { val = undefined; break; }
        }
        actualValue = String(val ?? 'undefined');
        if (rule.operator === 'equals') passed = String(val) === String(rule.expectedValue);
        else if (rule.operator === 'contains') passed = String(val).toLowerCase().includes(rule.expectedValue.toLowerCase());
        else if (rule.operator === 'greater_than') passed = Number(val) > Number(rule.expectedValue);
        else if (rule.operator === 'less_than') passed = Number(val) < Number(rule.expectedValue);
      }
    } catch (err: any) {
      passed = false;
      evalError = err.message;
    }

    if (!passed) allPassed = false;
    results.push({ passed, ruleSummary: summary, actualValue, error: evalError });
  }

  return { allPassed, results };
}
