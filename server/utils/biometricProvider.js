/**
 * ==============================================================================
 * SECURE E-VOTING SYSTEM — BIOMETRIC PROVIDER ABSTRACTION
 * ==============================================================================
 * Architectural abstraction layer decoupling biometric authentication methods
 * from core ballot casting logic.
 *
 * Supported Providers:
 * - BrowserFaceProvider (Current client-side facial AI embedding matching)
 * - WebAuthnProvider (Future FIDO2 / Passkey hardware attestation)
 * - HardwareBiometricProvider (Future physical poll-site biometric scanner)
 * ==============================================================================
 */

const { euclideanDistance } = require("./faceUtils");

class BiometricProvider {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Verifies incoming verification payload against enrolled credentials.
   * @param {any} enrolledData
   * @param {any} incomingPayload
   * @param {Object} [options]
   * @returns {Promise<{ verified: boolean, score?: number, message?: string }>}
   */
  async verify(enrolledData, incomingPayload, options = {}) {
    throw new Error(`verify() must be implemented by ${this.constructor.name}`);
  }
}

/**
 * BrowserFaceProvider:
 * Validates 128-dimensional facial descriptor vectors using Euclidean distance.
 */
class BrowserFaceProvider extends BiometricProvider {
  constructor(threshold = 0.55) {
    super("BrowserFaceProvider");
    this.threshold = threshold;
  }

  async verify(enrolledDescriptor, incomingDescriptor, options = {}) {
    const threshold = options.threshold || this.threshold;

    if (!Array.isArray(enrolledDescriptor) || enrolledDescriptor.length === 0) {
      return {
        verified: false,
        message: "No registered facial biometric profile found for voter",
      };
    }

    if (!Array.isArray(incomingDescriptor) || incomingDescriptor.length !== enrolledDescriptor.length) {
      return {
        verified: false,
        message: `Invalid descriptor vector length: received ${incomingDescriptor ? incomingDescriptor.length : 0}, expected ${enrolledDescriptor.length}`,
      };
    }

    const distance = euclideanDistance(enrolledDescriptor, incomingDescriptor);
    const verified = distance <= threshold;

    return {
      verified,
      score: distance,
      threshold,
      message: verified
        ? "Facial biometric verified within allowable threshold"
        : `Facial mismatch: distance ${distance.toFixed(4)} exceeded threshold ${threshold}`,
    };
  }
}

/**
 * WebAuthnProvider (Architectural Extension):
 * Placeholder for future FIDO2 WebAuthn cryptographic hardware attestation.
 */
class WebAuthnProvider extends BiometricProvider {
  constructor() {
    super("WebAuthnProvider");
  }

  async verify(enrolledKey, clientAssertion) {
    throw new Error("WebAuthnProvider: Hardware attestation requires external FIDO2 server integration.");
  }
}

// Active Provider Instance
const defaultProvider = new BrowserFaceProvider(0.55);

function getBiometricProvider(type = "face") {
  switch (type.toLowerCase()) {
    case "face":
    case "browser_face":
      return defaultProvider;
    case "webauthn":
      return new WebAuthnProvider();
    default:
      return defaultProvider;
  }
}

module.exports = {
  BiometricProvider,
  BrowserFaceProvider,
  WebAuthnProvider,
  getBiometricProvider,
};
