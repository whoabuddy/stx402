import { DurableObject } from "cloudflare:workers";

/**
 * UserDurableObject - Per-user SQLite-backed Durable Object
 *
 * Each payer address gets their own DO instance with isolated SQLite storage.
 * Provides counters, links, locks, custom SQL queries, and other stateful operations.
 *
 * Design principles (per Cloudflare best practices):
 * - Use SQLite for structured data (recommended over KV)
 * - Use RPC methods for clean interface
 * - Initialize tables lazily on first use
 * - Each user's data is completely isolated
 */
export class UserDurableObject extends DurableObject<Env> {
  private sql: SqlStorage;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  /**
   * Initialize the database schema (called lazily)
   */
  private initializeSchema(): void {
    if (this.initialized) return;

    // Counters table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0,
        min_value INTEGER,
        max_value INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Generic key-value table for future use
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS user_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Links table for URL shortener
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS links (
        slug TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT,
        clicks INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Link clicks table for tracking stats
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS link_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        clicked_at TEXT NOT NULL,
        referrer TEXT,
        user_agent TEXT,
        country TEXT,
        FOREIGN KEY (slug) REFERENCES links(slug) ON DELETE CASCADE
      )
    `);

    // Index for efficient click queries
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_link_clicks_slug ON link_clicks(slug)
    `);

    // Locks table for distributed locking
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS locks (
        name TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        acquired_at TEXT NOT NULL
      )
    `);

    // Index for efficient lock cleanup
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_locks_expires ON locks(expires_at)
    `);

    // Jobs table for queue functionality
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        queue TEXT NOT NULL,
        payload TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        available_at TEXT NOT NULL,
        visibility_timeout TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        failed_at TEXT,
        error TEXT
      )
    `);

    // Indexes for efficient queue operations
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_queue_status ON jobs(queue, status)
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_available ON jobs(queue, status, available_at, priority DESC)
    `);

    this.initialized = true;
  }

  // ===========================================================================
  // Counter Operations
  // ===========================================================================

  /**
   * Increment a counter by a given step
   */
  async counterIncrement(
    name: string,
    step: number = 1,
    options?: { min?: number; max?: number }
  ): Promise<{ name: string; value: number; previousValue: number; capped: boolean }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    // Get or create counter
    const existing = this.sql
      .exec("SELECT value, min_value, max_value FROM counters WHERE name = ?", name)
      .toArray();

    let previousValue: number;
    let minValue = options?.min ?? null;
    let maxValue = options?.max ?? null;

    if (existing.length === 0) {
      // Create new counter
      previousValue = 0;
      this.sql.exec(
        `INSERT INTO counters (name, value, min_value, max_value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        name,
        step,
        minValue,
        maxValue,
        now,
        now
      );
    } else {
      previousValue = existing[0].value as number;
      // Use stored bounds if not overridden
      if (minValue === null) minValue = existing[0].min_value as number | null;
      if (maxValue === null) maxValue = existing[0].max_value as number | null;
    }

    let newValue = previousValue + step;
    let capped = false;

    // Apply bounds
    if (maxValue !== null && newValue > maxValue) {
      newValue = maxValue;
      capped = true;
    }
    if (minValue !== null && newValue < minValue) {
      newValue = minValue;
      capped = true;
    }

    if (existing.length > 0) {
      this.sql.exec(
        `UPDATE counters SET value = ?, min_value = ?, max_value = ?, updated_at = ? WHERE name = ?`,
        newValue,
        minValue,
        maxValue,
        now,
        name
      );
    }

    return { name, value: newValue, previousValue, capped };
  }

  /**
   * Decrement a counter by a given step
   */
  async counterDecrement(
    name: string,
    step: number = 1,
    options?: { min?: number; max?: number }
  ): Promise<{ name: string; value: number; previousValue: number; capped: boolean }> {
    return this.counterIncrement(name, -step, options);
  }

  /**
   * Get the current value of a counter
   */
  async counterGet(name: string): Promise<{
    name: string;
    value: number;
    min: number | null;
    max: number | null;
    createdAt: string;
    updatedAt: string;
  } | null> {
    this.initializeSchema();

    const result = this.sql
      .exec(
        "SELECT value, min_value, max_value, created_at, updated_at FROM counters WHERE name = ?",
        name
      )
      .toArray();

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      name,
      value: row.value as number,
      min: row.min_value as number | null,
      max: row.max_value as number | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  /**
   * Reset a counter to zero (or a specified value)
   */
  async counterReset(
    name: string,
    resetTo: number = 0
  ): Promise<{ name: string; value: number; previousValue: number }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    const existing = this.sql
      .exec("SELECT value FROM counters WHERE name = ?", name)
      .toArray();

    const previousValue = existing.length > 0 ? (existing[0].value as number) : 0;

    if (existing.length === 0) {
      // Create counter at reset value
      this.sql.exec(
        `INSERT INTO counters (name, value, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        name,
        resetTo,
        now,
        now
      );
    } else {
      this.sql.exec(
        `UPDATE counters SET value = ?, updated_at = ? WHERE name = ?`,
        resetTo,
        now,
        name
      );
    }

    return { name, value: resetTo, previousValue };
  }

  /**
   * List all counters
   */
  async counterList(): Promise<
    Array<{
      name: string;
      value: number;
      min: number | null;
      max: number | null;
      updatedAt: string;
    }>
  > {
    this.initializeSchema();

    const results = this.sql
      .exec("SELECT name, value, min_value, max_value, updated_at FROM counters ORDER BY name")
      .toArray();

    return results.map((row) => ({
      name: row.name as string,
      value: row.value as number,
      min: row.min_value as number | null,
      max: row.max_value as number | null,
      updatedAt: row.updated_at as string,
    }));
  }

  /**
   * Delete a counter
   */
  async counterDelete(name: string): Promise<{ deleted: boolean; name: string }> {
    this.initializeSchema();

    const existing = this.sql
      .exec("SELECT 1 FROM counters WHERE name = ?", name)
      .toArray();

    if (existing.length === 0) {
      return { deleted: false, name };
    }

    this.sql.exec("DELETE FROM counters WHERE name = ?", name);
    return { deleted: true, name };
  }

  // ===========================================================================
  // Link Operations (URL Shortener)
  // ===========================================================================

  /**
   * Generate a random slug for short links
   */
  private generateSlug(length: number = 6): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let slug = "";
    for (let i = 0; i < length; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
  }

  /**
   * Create a new short link
   */
  async linkCreate(
    url: string,
    options?: {
      slug?: string;
      title?: string;
      ttl?: number; // seconds until expiration
    }
  ): Promise<{
    slug: string;
    url: string;
    title: string | null;
    expiresAt: string | null;
    createdAt: string;
  }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    // Generate or validate slug
    let slug = options?.slug;
    if (slug) {
      // Validate custom slug
      if (slug.length < 3 || slug.length > 32) {
        throw new Error("Slug must be 3-32 characters");
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
        throw new Error("Slug can only contain letters, numbers, hyphens, and underscores");
      }
      // Check if slug already exists
      const existing = this.sql
        .exec("SELECT 1 FROM links WHERE slug = ?", slug)
        .toArray();
      if (existing.length > 0) {
        throw new Error(`Slug '${slug}' already exists`);
      }
    } else {
      // Generate unique slug
      let attempts = 0;
      do {
        slug = this.generateSlug();
        const existing = this.sql
          .exec("SELECT 1 FROM links WHERE slug = ?", slug)
          .toArray();
        if (existing.length === 0) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new Error("Failed to generate unique slug");
      }
    }

    // Calculate expiration
    const expiresAt = options?.ttl
      ? new Date(Date.now() + options.ttl * 1000).toISOString()
      : null;

    // Insert link
    this.sql.exec(
      `INSERT INTO links (slug, url, title, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      slug,
      url,
      options?.title ?? null,
      expiresAt,
      now,
      now
    );

    return {
      slug,
      url,
      title: options?.title ?? null,
      expiresAt,
      createdAt: now,
    };
  }

  /**
   * Get a link by slug (for expanding/redirecting)
   */
  async linkGet(slug: string): Promise<{
    slug: string;
    url: string;
    title: string | null;
    clicks: number;
    expiresAt: string | null;
    createdAt: string;
  } | null> {
    this.initializeSchema();

    const result = this.sql
      .exec(
        "SELECT slug, url, title, clicks, expires_at, created_at FROM links WHERE slug = ?",
        slug
      )
      .toArray();

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const expiresAt = row.expires_at as string | null;

    // Check if expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      // Clean up expired link
      this.sql.exec("DELETE FROM links WHERE slug = ?", slug);
      return null;
    }

    return {
      slug: row.slug as string,
      url: row.url as string,
      title: row.title as string | null,
      clicks: row.clicks as number,
      expiresAt,
      createdAt: row.created_at as string,
    };
  }

  /**
   * Record a click on a link
   */
  async linkRecordClick(
    slug: string,
    metadata?: {
      referrer?: string;
      userAgent?: string;
      country?: string;
    }
  ): Promise<{ recorded: boolean; clicks: number }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    // Check if link exists
    const existing = this.sql
      .exec("SELECT clicks FROM links WHERE slug = ?", slug)
      .toArray();

    if (existing.length === 0) {
      return { recorded: false, clicks: 0 };
    }

    // Increment click count
    this.sql.exec(
      "UPDATE links SET clicks = clicks + 1, updated_at = ? WHERE slug = ?",
      now,
      slug
    );

    // Record click details
    this.sql.exec(
      `INSERT INTO link_clicks (slug, clicked_at, referrer, user_agent, country)
       VALUES (?, ?, ?, ?, ?)`,
      slug,
      now,
      metadata?.referrer ?? null,
      metadata?.userAgent ?? null,
      metadata?.country ?? null
    );

    const newClicks = (existing[0].clicks as number) + 1;
    return { recorded: true, clicks: newClicks };
  }

  /**
   * Get link statistics
   */
  async linkStats(slug: string): Promise<{
    slug: string;
    url: string;
    title: string | null;
    clicks: number;
    createdAt: string;
    lastClickAt: string | null;
    referrers: Record<string, number>;
    recentClicks: Array<{
      clickedAt: string;
      referrer: string | null;
      country: string | null;
    }>;
  } | null> {
    this.initializeSchema();

    // Get link info
    const linkResult = this.sql
      .exec(
        "SELECT slug, url, title, clicks, created_at FROM links WHERE slug = ?",
        slug
      )
      .toArray();

    if (linkResult.length === 0) {
      return null;
    }

    const link = linkResult[0];

    // Get last click time
    const lastClickResult = this.sql
      .exec(
        "SELECT clicked_at FROM link_clicks WHERE slug = ? ORDER BY clicked_at DESC LIMIT 1",
        slug
      )
      .toArray();

    const lastClickAt = lastClickResult.length > 0
      ? (lastClickResult[0].clicked_at as string)
      : null;

    // Get referrer breakdown
    const referrerResult = this.sql
      .exec(
        `SELECT referrer, COUNT(*) as count FROM link_clicks
         WHERE slug = ? AND referrer IS NOT NULL
         GROUP BY referrer ORDER BY count DESC LIMIT 10`,
        slug
      )
      .toArray();

    const referrers: Record<string, number> = {};
    for (const row of referrerResult) {
      const ref = row.referrer as string;
      referrers[ref] = row.count as number;
    }

    // Get recent clicks
    const recentResult = this.sql
      .exec(
        `SELECT clicked_at, referrer, country FROM link_clicks
         WHERE slug = ? ORDER BY clicked_at DESC LIMIT 20`,
        slug
      )
      .toArray();

    const recentClicks = recentResult.map((row) => ({
      clickedAt: row.clicked_at as string,
      referrer: row.referrer as string | null,
      country: row.country as string | null,
    }));

    return {
      slug: link.slug as string,
      url: link.url as string,
      title: link.title as string | null,
      clicks: link.clicks as number,
      createdAt: link.created_at as string,
      lastClickAt,
      referrers,
      recentClicks,
    };
  }

  /**
   * List all links for the user
   */
  async linkList(): Promise<
    Array<{
      slug: string;
      url: string;
      title: string | null;
      clicks: number;
      expiresAt: string | null;
      createdAt: string;
    }>
  > {
    this.initializeSchema();

    // Clean up expired links first
    this.sql.exec(
      "DELETE FROM links WHERE expires_at IS NOT NULL AND expires_at < ?",
      new Date().toISOString()
    );

    const results = this.sql
      .exec(
        "SELECT slug, url, title, clicks, expires_at, created_at FROM links ORDER BY created_at DESC"
      )
      .toArray();

    return results.map((row) => ({
      slug: row.slug as string,
      url: row.url as string,
      title: row.title as string | null,
      clicks: row.clicks as number,
      expiresAt: row.expires_at as string | null,
      createdAt: row.created_at as string,
    }));
  }

  /**
   * Delete a link
   */
  async linkDelete(slug: string): Promise<{ deleted: boolean; slug: string }> {
    this.initializeSchema();

    const existing = this.sql
      .exec("SELECT 1 FROM links WHERE slug = ?", slug)
      .toArray();

    if (existing.length === 0) {
      return { deleted: false, slug };
    }

    // Delete clicks first (cascade should handle this but be explicit)
    this.sql.exec("DELETE FROM link_clicks WHERE slug = ?", slug);
    this.sql.exec("DELETE FROM links WHERE slug = ?", slug);

    return { deleted: true, slug };
  }

  // ===========================================================================
  // Lock Operations (Distributed Locking)
  // ===========================================================================

  /**
   * Generate a random token for lock ownership
   */
  private generateLockToken(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = new Date().toISOString();
    this.sql.exec("DELETE FROM locks WHERE expires_at < ?", now);
  }

  /**
   * Acquire a named lock
   * Returns token if acquired, null if lock is held by another
   */
  async lockAcquire(
    name: string,
    options?: { ttl?: number }
  ): Promise<{
    acquired: boolean;
    token: string | null;
    expiresAt: string | null;
    heldUntil?: string;
  }> {
    this.initializeSchema();
    this.cleanupExpiredLocks();

    const now = new Date();
    const ttl = Math.min(Math.max(options?.ttl ?? 60, 10), 300); // 10s min, 300s max, 60s default
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    // Check if lock exists and is not expired
    const existing = this.sql
      .exec("SELECT token, expires_at FROM locks WHERE name = ?", name)
      .toArray();

    if (existing.length > 0) {
      const lock = existing[0];
      const lockExpiresAt = lock.expires_at as string;

      // Lock is still held
      if (new Date(lockExpiresAt) > now) {
        return {
          acquired: false,
          token: null,
          expiresAt: null,
          heldUntil: lockExpiresAt,
        };
      }

      // Lock expired, delete it
      this.sql.exec("DELETE FROM locks WHERE name = ?", name);
    }

    // Acquire the lock
    const token = this.generateLockToken();
    this.sql.exec(
      `INSERT INTO locks (name, token, expires_at, acquired_at) VALUES (?, ?, ?, ?)`,
      name,
      token,
      expiresAt,
      now.toISOString()
    );

    return {
      acquired: true,
      token,
      expiresAt,
    };
  }

  /**
   * Release a lock (requires matching token)
   */
  async lockRelease(
    name: string,
    token: string
  ): Promise<{
    released: boolean;
    error?: string;
  }> {
    this.initializeSchema();

    // Check if lock exists with matching token
    const existing = this.sql
      .exec("SELECT token FROM locks WHERE name = ?", name)
      .toArray();

    if (existing.length === 0) {
      return { released: false, error: "Lock not found" };
    }

    const lock = existing[0];
    if (lock.token !== token) {
      return { released: false, error: "Invalid token" };
    }

    // Release the lock
    this.sql.exec("DELETE FROM locks WHERE name = ? AND token = ?", name, token);

    return { released: true };
  }

  /**
   * Check the status of a lock
   */
  async lockCheck(name: string): Promise<{
    locked: boolean;
    expiresAt: string | null;
    acquiredAt: string | null;
  }> {
    this.initializeSchema();
    this.cleanupExpiredLocks();

    const existing = this.sql
      .exec("SELECT expires_at, acquired_at FROM locks WHERE name = ?", name)
      .toArray();

    if (existing.length === 0) {
      return {
        locked: false,
        expiresAt: null,
        acquiredAt: null,
      };
    }

    const lock = existing[0];
    return {
      locked: true,
      expiresAt: lock.expires_at as string,
      acquiredAt: lock.acquired_at as string,
    };
  }

  /**
   * Extend a lock's TTL (requires matching token)
   */
  async lockExtend(
    name: string,
    token: string,
    options?: { ttl?: number }
  ): Promise<{
    extended: boolean;
    expiresAt: string | null;
    error?: string;
  }> {
    this.initializeSchema();

    // Check if lock exists with matching token
    const existing = this.sql
      .exec("SELECT token, expires_at FROM locks WHERE name = ?", name)
      .toArray();

    if (existing.length === 0) {
      return { extended: false, expiresAt: null, error: "Lock not found" };
    }

    const lock = existing[0];
    if (lock.token !== token) {
      return { extended: false, expiresAt: null, error: "Invalid token" };
    }

    // Check if lock has already expired
    if (new Date(lock.expires_at as string) < new Date()) {
      // Clean up expired lock
      this.sql.exec("DELETE FROM locks WHERE name = ?", name);
      return { extended: false, expiresAt: null, error: "Lock has expired" };
    }

    // Extend the lock
    const ttl = Math.min(Math.max(options?.ttl ?? 60, 10), 300);
    const newExpiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    this.sql.exec(
      "UPDATE locks SET expires_at = ? WHERE name = ? AND token = ?",
      newExpiresAt,
      name,
      token
    );

    return {
      extended: true,
      expiresAt: newExpiresAt,
    };
  }

  /**
   * List all active locks
   */
  async lockList(): Promise<
    Array<{
      name: string;
      expiresAt: string;
      acquiredAt: string;
    }>
  > {
    this.initializeSchema();
    this.cleanupExpiredLocks();

    const results = this.sql
      .exec("SELECT name, expires_at, acquired_at FROM locks ORDER BY acquired_at DESC")
      .toArray();

    return results.map((row) => ({
      name: row.name as string,
      expiresAt: row.expires_at as string,
      acquiredAt: row.acquired_at as string,
    }));
  }

  // ===========================================================================
  // SQL Query Operations
  // ===========================================================================

  /**
   * Execute a read-only SQL query against the user's database
   * Only SELECT queries are allowed for security
   */
  async sqlQuery(
    query: string,
    params: unknown[] = []
  ): Promise<{
    rows: unknown[];
    rowCount: number;
    columns: string[];
  }> {
    this.initializeSchema();

    // Security: Only allow SELECT queries
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed. Use dedicated endpoints for mutations.");
    }

    // Prevent dangerous patterns
    const dangerous = ["DROP", "DELETE", "INSERT", "UPDATE", "CREATE", "ALTER", "PRAGMA"];
    for (const keyword of dangerous) {
      if (normalizedQuery.includes(keyword)) {
        throw new Error(`Query contains forbidden keyword: ${keyword}`);
      }
    }

    const cursor = this.sql.exec(query, ...params);
    const rows = cursor.toArray();

    // Extract column names from first row
    const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];

    return {
      rows,
      rowCount: rows.length,
      columns,
    };
  }

  /**
   * Execute a write SQL query (CREATE TABLE, INSERT, UPDATE, DELETE)
   * Limited to user's own tables (not system tables)
   */
  async sqlExecute(
    query: string,
    params: unknown[] = []
  ): Promise<{
    success: boolean;
    rowsAffected: number;
  }> {
    this.initializeSchema();

    // Security: Prevent modification of system tables
    const normalizedQuery = query.trim().toUpperCase();
    const systemTables = ["COUNTERS", "USER_DATA", "LINKS", "LINK_CLICKS", "LOCKS", "JOBS"];

    for (const table of systemTables) {
      // Check if trying to DROP or ALTER system tables
      if (
        (normalizedQuery.includes("DROP") || normalizedQuery.includes("ALTER")) &&
        normalizedQuery.includes(table)
      ) {
        throw new Error(`Cannot modify system table: ${table.toLowerCase()}`);
      }
    }

    // Prevent PRAGMA modifications
    if (normalizedQuery.startsWith("PRAGMA") && normalizedQuery.includes("=")) {
      throw new Error("Cannot modify PRAGMA settings");
    }

    const cursor = this.sql.exec(query, ...params);

    return {
      success: true,
      rowsAffected: cursor.rowsWritten,
    };
  }

  /**
   * Get database schema information
   */
  async sqlSchema(): Promise<{
    tables: Array<{
      name: string;
      sql: string;
    }>;
  }> {
    this.initializeSchema();

    const tables = this.sql
      .exec("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .toArray();

    return {
      tables: tables.map((row) => ({
        name: row.name as string,
        sql: row.sql as string,
      })),
    };
  }

  // ===========================================================================
  // Queue Operations (Job Queue)
  // ===========================================================================

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 16; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `job_${id}`;
  }

  /**
   * Clean up visibility timeouts (make jobs available again if popped but not completed)
   */
  private cleanupVisibilityTimeouts(queue: string): void {
    const now = new Date().toISOString();
    // Jobs that have visibility_timeout expired and are still "processing" become "pending" again
    this.sql.exec(
      `UPDATE jobs SET status = 'pending', visibility_timeout = NULL, updated_at = ?, attempt = attempt + 1
       WHERE queue = ? AND status = 'processing' AND visibility_timeout < ?`,
      now,
      queue,
      now
    );
  }

  /**
   * Push a new job to a queue
   */
  async queuePush(
    queue: string,
    payload: unknown,
    options?: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    }
  ): Promise<{
    jobId: string;
    queue: string;
    position: number;
  }> {
    this.initializeSchema();
    const now = new Date();
    const nowStr = now.toISOString();

    const jobId = this.generateJobId();
    const priority = options?.priority ?? 0;
    const delay = options?.delay ?? 0;
    const maxAttempts = options?.maxAttempts ?? 3;
    const availableAt = new Date(now.getTime() + delay * 1000).toISOString();

    // Serialize payload
    const payloadStr = JSON.stringify(payload);

    this.sql.exec(
      `INSERT INTO jobs (id, queue, payload, priority, status, max_attempts, available_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      jobId,
      queue,
      payloadStr,
      priority,
      maxAttempts,
      availableAt,
      nowStr,
      nowStr
    );

    // Get position in queue (count of pending jobs with higher or equal priority ahead of this one)
    const positionResult = this.sql
      .exec(
        `SELECT COUNT(*) as count FROM jobs
         WHERE queue = ? AND status = 'pending' AND available_at <= ?
         AND (priority > ? OR (priority = ? AND created_at < ?))`,
        queue,
        nowStr,
        priority,
        priority,
        nowStr
      )
      .toArray();

    const position = (positionResult[0]?.count as number) + 1;

    return { jobId, queue, position };
  }

  /**
   * Pop the next available job from a queue
   */
  async queuePop(
    queue: string,
    options?: {
      visibility?: number; // seconds before job becomes available again if not completed
    }
  ): Promise<{
    jobId: string;
    payload: unknown;
    attempt: number;
  } | { empty: true }> {
    this.initializeSchema();
    this.cleanupVisibilityTimeouts(queue);

    const now = new Date();
    const nowStr = now.toISOString();
    const visibility = options?.visibility ?? 60; // default 60 seconds
    const visibilityTimeout = new Date(now.getTime() + visibility * 1000).toISOString();

    // Find the next available job (highest priority, oldest, available)
    const jobs = this.sql
      .exec(
        `SELECT id, payload, attempt FROM jobs
         WHERE queue = ? AND status = 'pending' AND available_at <= ?
         ORDER BY priority DESC, created_at ASC
         LIMIT 1`,
        queue,
        nowStr
      )
      .toArray();

    if (jobs.length === 0) {
      return { empty: true };
    }

    const job = jobs[0];
    const jobId = job.id as string;
    const attempt = (job.attempt as number) + 1;

    // Mark job as processing with visibility timeout
    this.sql.exec(
      `UPDATE jobs SET status = 'processing', visibility_timeout = ?, attempt = ?, updated_at = ?
       WHERE id = ?`,
      visibilityTimeout,
      attempt,
      nowStr,
      jobId
    );

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(job.payload as string);
    } catch {
      payload = job.payload;
    }

    return { jobId, payload, attempt };
  }

  /**
   * Mark a job as completed
   */
  async queueComplete(jobId: string): Promise<{
    completed: boolean;
    error?: string;
  }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    // Check if job exists and is processing
    const existing = this.sql
      .exec("SELECT status FROM jobs WHERE id = ?", jobId)
      .toArray();

    if (existing.length === 0) {
      return { completed: false, error: "Job not found" };
    }

    const status = existing[0].status as string;
    if (status !== "processing") {
      return { completed: false, error: `Job is not processing (status: ${status})` };
    }

    // Mark as completed
    this.sql.exec(
      `UPDATE jobs SET status = 'completed', completed_at = ?, updated_at = ?, visibility_timeout = NULL
       WHERE id = ?`,
      now,
      now,
      jobId
    );

    return { completed: true };
  }

  /**
   * Mark a job as failed (will retry or go to dead letter)
   */
  async queueFail(
    jobId: string,
    options?: {
      error?: string;
      retry?: boolean;
    }
  ): Promise<{
    failed: boolean;
    willRetry: boolean;
    error?: string;
  }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    // Check if job exists
    const existing = this.sql
      .exec("SELECT status, attempt, max_attempts, queue FROM jobs WHERE id = ?", jobId)
      .toArray();

    if (existing.length === 0) {
      return { failed: false, willRetry: false, error: "Job not found" };
    }

    const job = existing[0];
    const status = job.status as string;
    const attempt = job.attempt as number;
    const maxAttempts = job.max_attempts as number;

    if (status !== "processing") {
      return { failed: false, willRetry: false, error: `Job is not processing (status: ${status})` };
    }

    const shouldRetry = options?.retry !== false && attempt < maxAttempts;
    const errorMsg = options?.error ?? null;

    if (shouldRetry) {
      // Calculate exponential backoff: 2^attempt seconds (2, 4, 8, 16...)
      const backoff = Math.min(Math.pow(2, attempt), 300); // cap at 5 minutes
      const availableAt = new Date(Date.now() + backoff * 1000).toISOString();

      // Mark as pending for retry
      this.sql.exec(
        `UPDATE jobs SET status = 'pending', available_at = ?, error = ?, updated_at = ?, visibility_timeout = NULL
         WHERE id = ?`,
        availableAt,
        errorMsg,
        now,
        jobId
      );

      return { failed: true, willRetry: true };
    } else {
      // Mark as dead (exceeded max attempts)
      this.sql.exec(
        `UPDATE jobs SET status = 'dead', failed_at = ?, error = ?, updated_at = ?, visibility_timeout = NULL
         WHERE id = ?`,
        now,
        errorMsg,
        now,
        jobId
      );

      return { failed: true, willRetry: false };
    }
  }

  /**
   * Get queue status and statistics
   */
  async queueStatus(queue: string): Promise<{
    queue: string;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead: number;
    total: number;
    oldestPending: string | null;
    newestPending: string | null;
  }> {
    this.initializeSchema();
    this.cleanupVisibilityTimeouts(queue);

    // Get counts by status
    const counts = this.sql
      .exec(
        `SELECT status, COUNT(*) as count FROM jobs WHERE queue = ? GROUP BY status`,
        queue
      )
      .toArray();

    const statusCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };

    for (const row of counts) {
      const status = row.status as string;
      statusCounts[status] = row.count as number;
    }

    // Get oldest and newest pending jobs
    const oldest = this.sql
      .exec(
        `SELECT created_at FROM jobs WHERE queue = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1`,
        queue
      )
      .toArray();

    const newest = this.sql
      .exec(
        `SELECT created_at FROM jobs WHERE queue = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
        queue
      )
      .toArray();

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return {
      queue,
      pending: statusCounts.pending,
      processing: statusCounts.processing,
      completed: statusCounts.completed,
      failed: statusCounts.failed,
      dead: statusCounts.dead,
      total,
      oldestPending: oldest.length > 0 ? (oldest[0].created_at as string) : null,
      newestPending: newest.length > 0 ? (newest[0].created_at as string) : null,
    };
  }

  /**
   * List jobs in a queue with optional filters
   */
  async queueList(
    queue: string,
    options?: {
      status?: string;
      limit?: number;
    }
  ): Promise<
    Array<{
      jobId: string;
      status: string;
      priority: number;
      attempt: number;
      createdAt: string;
      error: string | null;
    }>
  > {
    this.initializeSchema();

    const limit = Math.min(options?.limit ?? 100, 1000);
    const status = options?.status;

    let results;
    if (status) {
      results = this.sql
        .exec(
          `SELECT id, status, priority, attempt, created_at, error FROM jobs
           WHERE queue = ? AND status = ?
           ORDER BY priority DESC, created_at ASC
           LIMIT ?`,
          queue,
          status,
          limit
        )
        .toArray();
    } else {
      results = this.sql
        .exec(
          `SELECT id, status, priority, attempt, created_at, error FROM jobs
           WHERE queue = ?
           ORDER BY priority DESC, created_at ASC
           LIMIT ?`,
          queue,
          limit
        )
        .toArray();
    }

    return results.map((row) => ({
      jobId: row.id as string,
      status: row.status as string,
      priority: row.priority as number,
      attempt: row.attempt as number,
      createdAt: row.created_at as string,
      error: row.error as string | null,
    }));
  }
}
