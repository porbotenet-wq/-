import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    // Public client (respects RLS)
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    // Admin client (bypasses RLS) — for server-side operations
    if (serviceKey) {
      this.adminClient = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });
    } else {
      this.adminClient = this.client;
    }

    console.log('[Supabase] Clients initialized');
  }

  /** Public client (respects RLS) */
  getClient(): SupabaseClient {
    return this.client;
  }

  /** Admin client (bypasses RLS) — for server-side operations */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /** Upload file to Supabase Storage */
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
  ) {
    const { data, error } = await this.adminClient.storage
      .from(bucket)
      .upload(path, file, { contentType, upsert: false });

    if (error) throw error;
    return data;
  }

  /** Get signed URL for file download */
  async getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
    const { data, error } = await this.adminClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  /** Delete file from Supabase Storage */
  async deleteFile(bucket: string, paths: string[]) {
    const { error } = await this.adminClient.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
}
