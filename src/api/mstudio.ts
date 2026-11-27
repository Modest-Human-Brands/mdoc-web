/**
 * MStudio is a desktop app that reaches the USB signing token. It listens only on this computer,
 * so these requests carry no API key and never go through the MDoc server.
 */
export const MSTUDIO_URL = 'http://127.0.0.1:8720/api'

const QUICK_TIMEOUT = 8000

export interface TokenCertificate {
  index: number
  subject: string
  issuer: string
  certificateDerHex: string
  certificateChainDerHex: string[]
}

export class MStudioError extends Error {
  /** False when nothing answered: the app is closed, or it does not allow this website. */
  readonly reachable: boolean

  constructor(message: string, reachable = true) {
    super(message)
    this.name = 'MStudioError'
    this.reachable = reachable
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${MSTUDIO_URL}${path}`, init)
  } catch {
    throw new MStudioError('Couldn’t reach MStudio on this computer.', false)
  }
  if (!response.ok) {
    const message = (await response.text().catch(() => '')).trim()
    throw new MStudioError(message || `MStudio answered with ${response.status}.`)
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new MStudioError('MStudio sent an answer this app can’t read.')
  }
}

export const mstudioApi = {
  async certificates(): Promise<TokenCertificate[]> {
    const response = await call<{ certificates?: TokenCertificate[] }>('/certificates', {
      signal: AbortSignal.timeout(QUICK_TIMEOUT),
    })
    return response.certificates ?? []
  },

  /** No timeout: Windows waits for the signer to type the token PIN. */
  async signHash(digestHex: string, certificateIndex: number): Promise<string> {
    const query = new URLSearchParams({
      digest_hex: digestHex,
      cert_index: String(certificateIndex),
    })
    const response = await call<{ signatureHex?: string }>(`/sign-hash?${query}`, {
      method: 'POST',
    })
    if (!response.signatureHex) throw new MStudioError('MStudio returned no signature.')
    return response.signatureHex
  },
}