import { DurableObject } from "cloudflare:workers";

/**
 * UserDurableObject - Per-user SQLite-backed Durable Object
 *
 * Each payer address gets their own DO instance with isolated SQLite storage.
 * Used for Links (URL shortener) functionality.
 *
 * Design principles (per Cloudflare best practices):
 * - Use SQLite for structured data (recommended over KV)
 * - Use RPC methods for clean interface
 * - Initialize tables once in constructor with blockConcurrencyWhile
 * - Each user's data is completely isolated
 */
export class UserDurableObject extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // Initialize schema once using blockConcurrencyWhile
    // This ensures schema is created before any methods are called
    ctx.blockConcurrencyWhile(async () => {
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
    });
  }

  // ===========================================================================
  // Link Operations (URL Shortener)
  // ===========================================================================

  /**
   * Clean up expired links
   * @param slug - Optional specific slug to check, or undefined to clean all expired
   */
  private cleanupExpired(slug?: string): void {
    const now = new Date().toISOString();
    if (slug) {
      // Single-item cleanup for specific slug
      this.sql.exec("DELETE FROM links WHERE slug = ? AND expires_at IS NOT NULL AND expires_at < ?", slug, now);
    } else {
      // Batch cleanup for all expired links
      this.sql.exec("DELETE FROM links WHERE expires_at IS NOT NULL AND expires_at < ?", now);
    }
  }

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

    // Check if expired and clean up if needed
    if (expiresAt && new Date(expiresAt) < new Date()) {
      this.cleanupExpired(slug);
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
    const now = new Date().toISOString();

    // Increment click count (no-op if slug doesn't exist due to WHERE clause)
    this.sql.exec(
      "UPDATE links SET clicks = clicks + 1, updated_at = ? WHERE slug = ?",
      now,
      slug
    );

    // Check if the update affected a row by reading the new count
    const result = this.sql
      .exec("SELECT clicks FROM links WHERE slug = ?", slug)
      .toArray();

    if (result.length === 0) {
      return { recorded: false, clicks: 0 };
    }

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

    return { recorded: true, clicks: result[0].clicks as number };
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
    // Clean up expired links first
    this.cleanupExpired();

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
    // CASCADE handles link_clicks deletion automatically
    const cursor = this.sql.exec("DELETE FROM links WHERE slug = ?", slug);
    return { deleted: cursor.rowsWritten > 0, slug };
  }
}
