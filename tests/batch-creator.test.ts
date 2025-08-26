import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface BatchRecord {
  farmId: string;
  cropType: string;
  harvestDate: number;
  batchHash: Uint8Array;
  creator: string;
  createdAt: number;
  currentOwner: string;
  metadata: string;
}

interface VersionRecord {
  updatedHash: Uint8Array;
  updateNotes: string;
  timestamp: number;
}

interface LicenseRecord {
  expiry: number;
  terms: string;
  active: boolean;
}

interface CategoryRecord {
  category: string;
  tags: string[];
}

interface CollaboratorRecord {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface StatusRecord {
  status: string;
  visibility: boolean;
  lastUpdated: number;
}

interface RevenueShareRecord {
  percentage: number;
  totalReceived: number;
}

interface ContractState {
  batches: Map<number, BatchRecord>;
  batchVersions: Map<string, VersionRecord>; // Key: `${batchId}-${version}`
  batchLicenses: Map<string, LicenseRecord>; // Key: `${batchId}-${licensee}`
  batchCategories: Map<number, CategoryRecord>;
  batchCollaborators: Map<string, CollaboratorRecord>; // Key: `${batchId}-${collaborator}`
  batchStatus: Map<number, StatusRecord>;
  batchRevenueShares: Map<string, RevenueShareRecord>; // Key: `${batchId}-${participant}`
  batchOwners: Map<number, string>; // Simulates NFT ownership
  batchCounter: number;
  admin: string;
  paused: boolean;
  maxMetadataLen: number;
  blockHeight: number; // Mock block height
}

// Mock contract implementation
class BatchCreatorMock {
  private state: ContractState = {
    batches: new Map(),
    batchVersions: new Map(),
    batchLicenses: new Map(),
    batchCategories: new Map(),
    batchCollaborators: new Map(),
    batchStatus: new Map(),
    batchRevenueShares: new Map(),
    batchOwners: new Map(),
    batchCounter: 0,
    admin: "deployer",
    paused: false,
    maxMetadataLen: 500,
    blockHeight: 1000, // Starting mock block height
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_INVALID_HASH = 101;
  private ERR_BATCH_EXISTS = 102;
  private ERR_INVALID_ID = 103;
  private ERR_NOT_OWNER = 104;
  private ERR_INVALID_PARAM = 105;
  private ERR_ALREADY_REGISTERED = 106;
  private ERR_METADATA_TOO_LONG = 107;
  private ERR_INVALID_PERCENTAGE = 108;
  private ERR_EXPIRED = 109;

  // Helper to simulate block height increment
  private incrementBlockHeight() {
    this.state.blockHeight += 1;
  }

  // Simulate is-authorized-caller
  private isAuthorizedCaller(caller: string): boolean {
    return caller === this.state.admin || caller === "authorized_farmer";
  }

  createBatch(
    caller: string,
    farmId: string,
    cropType: string,
    harvestDate: number,
    batchHash: Uint8Array,
    metadata: string
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (!this.isAuthorizedCaller(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const batchId = this.state.batchCounter + 1;
    if (this.state.batches.has(batchId)) {
      return { ok: false, value: this.ERR_BATCH_EXISTS };
    }
    if (batchHash.length === 0) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    if (metadata.length > this.state.maxMetadataLen) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    this.state.batches.set(batchId, {
      farmId,
      cropType,
      harvestDate,
      batchHash,
      creator: caller,
      createdAt: this.state.blockHeight,
      currentOwner: caller,
      metadata,
    });
    this.state.batchOwners.set(batchId, caller);
    this.state.batchCounter = batchId;
    this.incrementBlockHeight();
    return { ok: true, value: batchId };
  }

  transferOwnership(caller: string, batchId: number, newOwner: string): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    batch.currentOwner = newOwner;
    this.state.batchOwners.set(batchId, newOwner);
    this.state.batches.set(batchId, batch);
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  registerNewVersion(
    caller: string,
    batchId: number,
    newHash: Uint8Array,
    version: number,
    notes: string
  ): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${batchId}-${version}`;
    if (this.state.batchVersions.has(key)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    this.state.batchVersions.set(key, {
      updatedHash: newHash,
      updateNotes: notes,
      timestamp: this.state.blockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  grantLicense(
    caller: string,
    batchId: number,
    licensee: string,
    duration: number,
    terms: string
  ): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${batchId}-${licensee}`;
    this.state.batchLicenses.set(key, {
      expiry: this.state.blockHeight + duration,
      terms,
      active: true,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  revokeLicense(caller: string, batchId: number, licensee: string): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${batchId}-${licensee}`;
    const license = this.state.batchLicenses.get(key);
    if (!license) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    license.active = false;
    this.state.batchLicenses.set(key, license);
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  addCategory(
    caller: string,
    batchId: number,
    category: string,
    tags: string[]
  ): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.batchCategories.set(batchId, { category, tags });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    batchId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${batchId}-${collaborator}`;
    if (this.state.batchCollaborators.has(key)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    this.state.batchCollaborators.set(key, {
      role,
      permissions,
      addedAt: this.state.blockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  updateStatus(
    caller: string,
    batchId: number,
    status: string,
    visibility: boolean
  ): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.batchStatus.set(batchId, {
      status,
      visibility,
      lastUpdated: this.state.blockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  setRevenueShare(
    caller: string,
    batchId: number,
    participant: string,
    percentage: number
  ): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_ID };
    }
    if (caller !== batch.currentOwner) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (percentage <= 0 || percentage > 100) {
      return { ok: false, value: this.ERR_INVALID_PERCENTAGE };
    }
    const key = `${batchId}-${participant}`;
    this.state.batchRevenueShares.set(key, {
      percentage,
      totalReceived: 0,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  getBatchDetails(batchId: number): ClarityResponse<BatchRecord | null> {
    return { ok: true, value: this.state.batches.get(batchId) ?? null };
  }

  getBatchVersion(batchId: number, version: number): ClarityResponse<VersionRecord | null> {
    const key = `${batchId}-${version}`;
    return { ok: true, value: this.state.batchVersions.get(key) ?? null };
  }

  getBatchLicense(batchId: number, licensee: string): ClarityResponse<LicenseRecord | null> {
    const key = `${batchId}-${licensee}`;
    const license = this.state.batchLicenses.get(key);
    if (license && license.expiry > this.state.blockHeight) {
      return { ok: true, value: license };
    }
    return { ok: true, value: null };
  }

  getBatchCategory(batchId: number): ClarityResponse<CategoryRecord | null> {
    return { ok: true, value: this.state.batchCategories.get(batchId) ?? null };
  }

  getBatchCollaborator(batchId: number, collaborator: string): ClarityResponse<CollaboratorRecord | null> {
    const key = `${batchId}-${collaborator}`;
    return { ok: true, value: this.state.batchCollaborators.get(key) ?? null };
  }

  getBatchStatus(batchId: number): ClarityResponse<StatusRecord | null> {
    return { ok: true, value: this.state.batchStatus.get(batchId) ?? null };
  }

  getBatchRevenueShare(batchId: number, participant: string): ClarityResponse<RevenueShareRecord | null> {
    const key = `${batchId}-${participant}`;
    return { ok: true, value: this.state.batchRevenueShares.get(key) ?? null };
  }

  getBatchOwner(batchId: number): ClarityResponse<string | null> {
    return { ok: true, value: this.state.batchOwners.get(batchId) ?? null };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.batchCounter };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  farmer: "authorized_farmer",
  user1: "wallet_1",
  user2: "wallet_2",
};

const mockHash = new Uint8Array(32).fill(1); // Mock 32-byte hash

describe("BatchCreator Contract", () => {
  let contract: BatchCreatorMock;

  beforeEach(() => {
    contract = new BatchCreatorMock();
    vi.resetAllMocks();
  });

  it("should create a new batch with valid parameters", () => {
    const result = contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Organic batch from farm X"
    );
    expect(result).toEqual({ ok: true, value: 1 });
    const details = contract.getBatchDetails(1);
    expect(details.value).toEqual(
      expect.objectContaining({
        cropType: "Tomatoes",
        metadata: "Organic batch from farm X",
      })
    );
    expect(contract.getBatchOwner(1)).toEqual({ ok: true, value: accounts.farmer });
    expect(contract.getCounter()).toEqual({ ok: true, value: 1 });
  });

  it("should prevent unauthorized caller from creating batch", () => {
    const result = contract.createBatch(
      accounts.user1,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Unauthorized"
    );
    expect(result).toEqual({ ok: false, value: 100 });
  });

  it("should prevent creation with invalid hash", () => {
    const result = contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      new Uint8Array(0),
      "Invalid hash"
    );
    expect(result).toEqual({ ok: false, value: 101 });
  });

  it("should prevent metadata exceeding max length", () => {
    const longMetadata = "a".repeat(501);
    const result = contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      longMetadata
    );
    expect(result).toEqual({ ok: false, value: 107 });
  });

  it("should allow ownership transfer", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const transferResult = contract.transferOwnership(accounts.farmer, 1, accounts.user1);
    expect(transferResult).toEqual({ ok: true, value: true });
    expect(contract.getBatchOwner(1)).toEqual({ ok: true, value: accounts.user1 });
    const details = contract.getBatchDetails(1);
    expect(details.value?.currentOwner).toBe(accounts.user1);
  });

  it("should prevent non-owner from transferring ownership", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const transferResult = contract.transferOwnership(accounts.user1, 1, accounts.user2);
    expect(transferResult).toEqual({ ok: false, value: 104 });
  });

  it("should register a new version", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const newHash = new Uint8Array(32).fill(2);
    const versionResult = contract.registerNewVersion(accounts.farmer, 1, newHash, 1, "Updated details");
    expect(versionResult).toEqual({ ok: true, value: true });
    const version = contract.getBatchVersion(1, 1);
    expect(version.value).toEqual(
      expect.objectContaining({
        updateNotes: "Updated details",
      })
    );
  });

  it("should prevent duplicate version registration", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    contract.registerNewVersion(accounts.farmer, 1, mockHash, 1, "First");
    const duplicate = contract.registerNewVersion(accounts.farmer, 1, mockHash, 1, "Duplicate");
    expect(duplicate).toEqual({ ok: false, value: 106 });
  });

  it("should add category", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const result = contract.addCategory(accounts.farmer, 1, "Vegetables", ["organic", "red"]);
    expect(result).toEqual({ ok: true, value: true });
    const category = contract.getBatchCategory(1);
    expect(category.value?.tags).toEqual(["organic", "red"]);
  });

  it("should add collaborator", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const result = contract.addCollaborator(accounts.farmer, 1, accounts.user1, "Harvester", ["view", "update"]);
    expect(result).toEqual({ ok: true, value: true });
    const collab = contract.getBatchCollaborator(1, accounts.user1);
    expect(collab.value?.role).toBe("Harvester");
  });

  it("should update status", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const result = contract.updateStatus(accounts.farmer, 1, "Shipped", true);
    expect(result).toEqual({ ok: true, value: true });
    const status = contract.getBatchStatus(1);
    expect(status.value?.status).toBe("Shipped");
  });

  it("should set revenue share", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const result = contract.setRevenueShare(accounts.farmer, 1, accounts.user1, 20);
    expect(result).toEqual({ ok: true, value: true });
    const share = contract.getBatchRevenueShare(1, accounts.user1);
    expect(share.value?.percentage).toBe(20);
  });

  it("should prevent invalid revenue percentage", () => {
    contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Test batch"
    );
    const result = contract.setRevenueShare(accounts.farmer, 1, accounts.user1, 101);
    expect(result).toEqual({ ok: false, value: 108 });
  });

  it("should pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: true });

    const createDuringPause = contract.createBatch(
      accounts.farmer,
      accounts.deployer,
      "Tomatoes",
      1000,
      mockHash,
      "Paused create"
    );
    expect(createDuringPause).toEqual({ ok: false, value: 100 });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-admin from pausing", () => {
    const pauseResult = contract.pauseContract(accounts.user1);
    expect(pauseResult).toEqual({ ok: false, value: 100 });
  });
});