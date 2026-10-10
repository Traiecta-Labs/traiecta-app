import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StellarWalletProvider } from "../src/wallets/stellar/context";
import type { StellarWalletContextValue } from "../src/wallets/stellar/types";

const STORAGE_KEY = "hyperion.stellar.wallet";
const STELLAR_WALLET_ID_KEY = "stellar_wallet_id";
const STELLAR_WALLET_ADDRESS_KEY = "stellar_wallet_address";

const NETWORKS_PUBLIC = "Public Global Stellar Network ; September 2015";
const NETWORKS_TESTNET = "Test SDF Network ; September 2015";

/**
 * The provider is called directly and react is replaced with the hooks it uses, so the mount
 * restore effect can be run and inspected without a renderer. State cells, effects and memo
 * results are recorded in order so a test can drive and assert the branches.
 */
const harness = vi.hoisted(() => ({
  cursor: 0,
  states: [] as unknown[],
  setters: [] as ((value: unknown) => void)[],
  effects: [] as (() => void)[],
  memos: [] as unknown[],
  refs: [] as { current: unknown }[],
}));

/** The kit instance the provider's dynamic import resolves to. */
const kit = vi.hoisted(() => ({
  instance: {
    init: vi.fn(),
    setNetwork: vi.fn(),
    setWallet: vi.fn(),
    getAddress: vi.fn(),
    fetchAddress: vi.fn(),
    authModal: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signAuthEntry: vi.fn(),
  },
}));

vi.mock("react", () => ({
  createContext: () => ({ Provider: { __provider: true }, Consumer: { __consumer: true } }),
  useContext: () => null,
  useState: (initial: unknown) => {
    const index = harness.cursor;
    harness.cursor += 1;
    if (harness.states.length <= index) harness.states.push(initial);
    const setState = (next: unknown) => {
      const current = harness.states[index];
      harness.states[index] =
        typeof next === "function" ? (next as (prev: unknown) => unknown)(current) : next;
    };
    harness.setters[index] = setState;
    return [harness.states[index], setState];
  },
  useEffect: (fn: () => void) => {
    harness.effects.push(fn);
  },
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => {
    const value = fn();
    harness.memos.push(value);
    return value;
  },
  useRef: (initial: unknown) => {
    const ref = { current: initial };
    harness.refs.push(ref);
    return ref;
  },
}));

vi.mock("react/jsx-runtime", () => ({
  jsx: (type: unknown, props: unknown) => ({ type, props }),
  jsxs: (type: unknown, props: unknown) => ({ type, props }),
  Fragment: Symbol("Fragment"),
}));

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: kit.instance,
  Networks: { PUBLIC: NETWORKS_PUBLIC, TESTNET: NETWORKS_TESTNET },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class FreighterModule {
    readonly productId = "freighter";
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/xbull", () => ({
  xBullModule: class XBullModule {
    readonly productId = "xbull";
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/albedo", () => ({
  AlbedoModule: class AlbedoModule {
    readonly productId = "albedo";
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/lobstr", () => ({
  LobstrModule: class LobstrModule {
    readonly productId = "lobstr";
  },
}));

let store: Record<string, string> = {};
let removeItem: ReturnType<typeof vi.fn<(key: string) => void>>;
let setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

/** Call the provider as a plain function so its hooks run against the harness. */
function renderProvider(): void {
  StellarWalletProvider({ children: null });
}

/** Run the recorded effects, then let the async restore settle. */
async function runEffects(): Promise<void> {
  for (const effect of harness.effects) {
    effect();
  }
  await flush();
}

/** The context value the provider memoised, which carries connect, disconnect and setNetwork. */
function contextValue(): StellarWalletContextValue {
  const value = harness.memos[1];
  if (value === undefined) throw new Error("provider did not produce a context value");
  return value as StellarWalletContextValue;
}

beforeEach(() => {
  vi.resetAllMocks();
  store = {};
  harness.cursor = 0;
  harness.states = [];
  harness.setters = [];
  harness.effects = [];
  harness.memos = [];
  harness.refs = [];

  removeItem = vi.fn((key: string) => {
    Reflect.deleteProperty(store, key);
  });
  setItem = vi.fn((key: string, value: string) => {
    store[key] = value;
  });

  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem,
    removeItem,
    clear: vi.fn(() => {
      store = {};
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StellarWalletProvider session restore and network switching", () => {
  it("restores a saved wallet id and address from storage", async () => {
    store[STELLAR_WALLET_ID_KEY] = "freighter";
    store[STELLAR_WALLET_ADDRESS_KEY] = "GSAVEDADDRESS0000000000000000000000000000000000000000000";
    kit.instance.fetchAddress.mockResolvedValue({
      address: "GFETCHEDADDRESS000000000000000000000000000000000000000000",
    });

    renderProvider();
    await runEffects();

    expect(kit.instance.setWallet).toHaveBeenCalledWith("freighter");
    expect(kit.instance.fetchAddress).toHaveBeenCalledTimes(1);
    expect(harness.states[0]).toBe("GFETCHEDADDRESS000000000000000000000000000000000000000000");
    expect(setItem).toHaveBeenCalledWith(
      STELLAR_WALLET_ADDRESS_KEY,
      "GFETCHEDADDRESS000000000000000000000000000000000000000000",
    );
    expect(removeItem).not.toHaveBeenCalled();
  });

  it("clears the three storage keys and nulls the address when fetchAddress rejects", async () => {
    store[STELLAR_WALLET_ID_KEY] = "freighter";
    store[STELLAR_WALLET_ADDRESS_KEY] = "GSAVEDADDRESS0000000000000000000000000000000000000000000";
    kit.instance.fetchAddress.mockRejectedValue(new Error("extension closed"));

    renderProvider();
    await runEffects();

    expect(harness.states[0]).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(removeItem).toHaveBeenCalledWith(STELLAR_WALLET_ID_KEY);
    expect(removeItem).toHaveBeenCalledWith(STELLAR_WALLET_ADDRESS_KEY);
    expect(store[STORAGE_KEY]).toBeUndefined();
    expect(store[STELLAR_WALLET_ID_KEY]).toBeUndefined();
    expect(store[STELLAR_WALLET_ADDRESS_KEY]).toBeUndefined();
  });

  it("clears wallet state on disconnect even when the kit rejects", async () => {
    kit.instance.authModal.mockResolvedValue({
      address: "GCONNECTEDADDRESS00000000000000000000000000000000000000000",
    });
    kit.instance.disconnect.mockRejectedValue(new Error("kit offline"));

    renderProvider();
    const value = contextValue();
    await value.connect();

    await value.disconnect();

    expect(kit.instance.disconnect).toHaveBeenCalledTimes(1);
    expect(harness.states[0]).toBeNull();
    expect(harness.states[1]).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(removeItem).toHaveBeenCalledWith(STELLAR_WALLET_ID_KEY);
    expect(removeItem).toHaveBeenCalledWith(STELLAR_WALLET_ADDRESS_KEY);
  });

  it("forwards Networks.PUBLIC to the kit when setNetwork is called", async () => {
    kit.instance.authModal.mockResolvedValue({
      address: "GCONNECTEDADDRESS00000000000000000000000000000000000000000",
    });

    renderProvider();
    const value = contextValue();
    await value.connect();

    value.setNetwork("PUBLIC");
    await flush();
    await flush();

    expect(kit.instance.setNetwork).toHaveBeenCalledWith(NETWORKS_PUBLIC);
  });
});
