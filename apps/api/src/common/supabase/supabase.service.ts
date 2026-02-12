import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceKey = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    console.log('[Supabase] Client initialized');
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  /** Upload file to Supabase Storage */
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
  ) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(path, file, { contentType, upsert: false });

    if (error) throw error;
    return data;
  }

  /** Get signed URL for file download */
  async getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  /** Delete file from Supabase Storage */
  async deleteFile(bucket: string, paths: string[]) {
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
}
