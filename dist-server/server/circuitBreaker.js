/**
 * Circuit Breaker pattern implementation for outbound HTTP synthetic checks and AWS SDK operations.
 * Protects against cascading failures and socket exhaustion during target outages.
 */
export var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
export class CircuitBreaker {
    name;
    state = CircuitState.CLOSED;
    failureCount = 0;
    lastFailureTime = 0;
    halfOpenSuccesses = 0;
    failureThreshold;
    resetTimeoutMs;
    halfOpenMaxReqs;
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
        this.halfOpenMaxReqs = options.halfOpenMaxReqs ?? 2;
    }
    getState() {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenSuccesses = 0;
            }
        }
        return this.state;
    }
    async execute(fn) {
        const currentState = this.getState();
        if (currentState === CircuitState.OPEN) {
            throw new Error(`CircuitBreaker[${this.name}] is OPEN. Requests blocked to protect downstream systems.`);
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (err) {
            this.onFailure();
            throw err;
        }
    }
    onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenSuccesses++;
            if (this.halfOpenSuccesses >= this.halfOpenMaxReqs) {
                this.state = CircuitState.CLOSED;
                this.failureCount = 0;
            }
        }
        else if (this.state === CircuitState.CLOSED) {
            this.failureCount = 0;
        }
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
        }
    }
    getStats() {
        return {
            name: this.name,
            state: this.getState(),
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime
        };
    }
}
const registry = new Map();
export function getCircuitBreaker(name, options) {
    if (!registry.has(name)) {
        registry.set(name, new CircuitBreaker(name, options));
    }
    return registry.get(name);
}
