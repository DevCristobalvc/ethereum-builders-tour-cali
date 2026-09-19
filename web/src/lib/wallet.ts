"use client";
/**
 * Phone-side wallet. An EVM key lives in this browser only; a platform passkey
 * (FaceID/TouchID) gates every use. When the authenticator supports the WebAuthn
 * PRF extension (iOS 18+, Android 14+), the key is stored AES-GCM encrypted with
 * a secret only the passkey can derive — otherwise it is stored raw and the
 * passkey still provides user-presence + verification before any signing.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

const LS_KEY = "pap.wallet.v1";
const PRF_SALT = new TextEncoder().encode("pap-wallet-key-v1");

export type StoredWallet = {
  address: Address;
  credentialId: string; // base64url
  prf: boolean;
  pk?: Hex; // only when prf === false
  enc?: { iv: string; ct: string }; // base64url, only when prf === true
  createdAt: number;
};

export const b64u = {
  enc: (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
};

export function loadWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredWallet) : null;
  } catch {
    return null;
  }
}

export function clearWallet() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

export function passkeySupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

function rpId() {
  return location.hostname;
}

async function assert(credentialId: string, wantPrf: boolean): Promise<{ prf?: ArrayBuffer }> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: rpId(),
      allowCredentials: [{ id: b64u.dec(credentialId), type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extensions: wantPrf ? ({ prf: { eval: { first: PRF_SALT } } } as any) : undefined,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Passkey assertion cancelled");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ext = cred.getClientExtensionResults() as any;
  return { prf: ext?.prf?.results?.first as ArrayBuffer | undefined };
}

async function aesKey(secret: ArrayBuffer) {
  return crypto.subtle.importKey("raw", secret, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Create passkey + EVM key. Returns the stored wallet (never the raw key when PRF is available). */
export async function createWallet(label = "PAP wallet"): Promise<StoredWallet> {
  if (!passkeySupported()) throw new Error("Passkeys not supported in this browser");
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { id: rpId(), name: "Passport Agent Protocol" },
      user: { id: userId, name: `${label} ${new Date().toISOString().slice(0, 10)}`, displayName: label },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
      timeout: 60_000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extensions: { prf: {} } as any,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Passkey creation cancelled");
  const credentialId = b64u.enc(cred.rawId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prfEnabled = Boolean((cred.getClientExtensionResults() as any)?.prf?.enabled);

  const pk = generatePrivateKey();
  const address = privateKeyToAccount(pk).address;
  let wallet: StoredWallet;

  if (prfEnabled) {
    // Derive the wrapping key right away (needs a second FaceID prompt) and encrypt.
    const { prf } = await assert(credentialId, true);
    if (!prf) throw new Error("PRF advertised but not returned");
    const key = await aesKey(prf);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(pk));
    wallet = { address, credentialId, prf: true, enc: { iv: b64u.enc(iv), ct: b64u.enc(ct) }, createdAt: Date.now() };
  } else {
    wallet = { address, credentialId, prf: false, pk, createdAt: Date.now() };
  }
  localStorage.setItem(LS_KEY, JSON.stringify(wallet));
  return wallet;
}

/** FaceID → private key in memory for this operation only. */
export async function unlock(wallet: StoredWallet): Promise<Hex> {
  const { prf } = await assert(wallet.credentialId, wallet.prf);
  if (!wallet.prf) return wallet.pk!;
  if (!prf) throw new Error("Passkey did not return PRF secret");
  const key = await aesKey(prf);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64u.dec(wallet.enc!.iv) },
    key,
    b64u.dec(wallet.enc!.ct)
  );
  return new TextDecoder().decode(pt) as Hex;
}
