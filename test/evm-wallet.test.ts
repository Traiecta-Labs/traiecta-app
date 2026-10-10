import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEvmWallet } from "../src/wallets/evm/useEvmWallet";

const EVM_CONNECTED_KEY = "evm_wallet_connected";
const EVM_CONNECTOR_ID_KEY = "evm_connector_id";
const EVM_ADDRESS_KEY = "evm_wallet_address";

interface ConnectorMock {
  id: string;
  isAuthorized: () => Promise<boolean>;
}

/**
 * Shared state for the mocked wagmi surface.
 *
 * The hook reads its connection, connectors and mutation callbacks from wagmi; the factory
 * functions below close over this holder so each test can set the reconnect scenario up without
 * remocking the module.
 */
const mocks = vi.hoisted(() => {
  const connection: {
    address: `0x${string}` | undefined;
    chainId: number | undefined;
    chain: { name: string } | undefined;
    isConnected: boolean;
    isConnecting: boolean;
  } = {
    address: undefined,
    chainId: undefined,
    chain: undefined,
    isConnected: false,
    isConnecting: false,
  };

  return {
    connection,
    connectors: [] as ConnectorMock[],
    connectAsync: vi.fn(),
    disconnectAsync: vi.fn(),
    switchChainAsync: vi.fn(),
  };
});

// The hook is called directly rather than through a renderer, so react is replaced with the four
// hooks it uses and the effect body runs inline. That keeps the reconnect branch testable in the
// node environment the other tests run in.
vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void) => {
    fn();
  },
  useMemo: (fn: () => unknown) => fn(),
  useRef: (initial: unknown) => ({ current: initial }),
}));

vi.mock("wagmi", () => ({
  useConnection: () => mocks.connection,
  useConnectors: () => mocks.connectors,
  useConnect: () => ({ mutateAsync: mocks.connectAsync, isPending: false }),
  useDisconnect: () => ({ mutateAsync: mocks.disconnectAsync }),
  useSwitchChain: () => ({ mutateAsync: mocks.switchChainAsync }),
}));

let store: Record<string, string> = {};
let removeItem: ReturnType<typeof vi.fn<(key: string) => void>>;

function makeConnector(id: string, authorized: boolean | (() => Promise<boolean>)): ConnectorMock {
  const impl = typeof authorized === "function" ? authorized : () => Promise.resolve(authorized);
  return { id, isAuthorized: vi.fn(impl) };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  store = {};
  mocks.connectors = [];
  mocks.connection.address = undefined;
  mocks.connection.chainId = undefined;
  mocks.connection.chain = undefined;
  mocks.connection.isConnected = false;
  mocks.connection.isConnecting = false;

  removeItem = vi.fn((key: string) => {
    Reflect.deleteProperty(store, key);
  });

  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem,
    clear: vi.fn(() => {
      store = {};
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useEvmWallet reconnect and disconnect", () => {
  it("reconnects with the saved connector id rather than the first connector", async () => {
    store[EVM_CONNECTED_KEY] = "true";
    store[EVM_CONNECTOR_ID_KEY] = "io.metamask";

    const injected = makeConnector("injected", true);
    const metamask = makeConnector("io.metamask", true);
    mocks.connectors = [injected, metamask];

    const wallet = useEvmWallet();
    await flush();

    expect(metamask.isAuthorized).toHaveBeenCalledTimes(1);
    expect(injected.isAuthorized).not.toHaveBeenCalled();
    expect(mocks.connectAsync).toHaveBeenCalledTimes(1);
    expect(mocks.connectAsync).toHaveBeenCalledWith({ connector: metamask });
    expect(wallet.isConnected).toBe(false);
  });

  it("purges every stored key when the saved connector is not authorized", async () => {
    store[EVM_CONNECTED_KEY] = "true";
    store[EVM_CONNECTOR_ID_KEY] = "io.metamask";
    store[EVM_ADDRESS_KEY] = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    mocks.connectors = [makeConnector("io.metamask", false)];

    useEvmWallet();
    await flush();

    expect(mocks.connectAsync).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith(EVM_CONNECTED_KEY);
    expect(removeItem).toHaveBeenCalledWith(EVM_CONNECTOR_ID_KEY);
    expect(removeItem).toHaveBeenCalledWith(EVM_ADDRESS_KEY);
    expect(store[EVM_CONNECTED_KEY]).toBeUndefined();
    expect(store[EVM_CONNECTOR_ID_KEY]).toBeUndefined();
    expect(store[EVM_ADDRESS_KEY]).toBeUndefined();
  });

  it("purges every stored key when isAuthorized throws", async () => {
    store[EVM_CONNECTED_KEY] = "true";
    store[EVM_CONNECTOR_ID_KEY] = "injected";
    store[EVM_ADDRESS_KEY] = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    mocks.connectors = [
      makeConnector("injected", () => Promise.reject(new Error("extension closed"))),
    ];

    useEvmWallet();
    await flush();

    expect(mocks.connectAsync).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith(EVM_CONNECTED_KEY);
    expect(removeItem).toHaveBeenCalledWith(EVM_CONNECTOR_ID_KEY);
    expect(removeItem).toHaveBeenCalledWith(EVM_ADDRESS_KEY);
  });

  it("disconnect removes the saved connection, connector and address", async () => {
    store[EVM_CONNECTED_KEY] = "true";
    store[EVM_CONNECTOR_ID_KEY] = "io.metamask";
    store[EVM_ADDRESS_KEY] = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    mocks.connection.isConnected = true;

    const wallet = useEvmWallet();
    await wallet.disconnect();

    expect(mocks.disconnectAsync).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith(EVM_CONNECTED_KEY);
    expect(removeItem).toHaveBeenCalledWith(EVM_CONNECTOR_ID_KEY);
    expect(removeItem).toHaveBeenCalledWith(EVM_ADDRESS_KEY);
  });
});
