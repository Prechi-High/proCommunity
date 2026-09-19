import {
  productKey,
  productVideoKeyVariants,
  taxonomyKey,
  videoCommentKeyVariants,
} from './keys';
import { redisService } from './service';

async function delMany(keys: string[]): Promise<void> {
  const chunk = 50;
  for (let i = 0; i < keys.length; i += chunk) {
    await redisService.delete(...keys.slice(i, i + chunk));
  }
}

export const cacheInvalidation = {
  async invalidateProduct(productId: string): Promise<void> {
    if (!productId) return;
    await redisService.delete(productKey(productId));
    await this.invalidateProductVideos(productId);
  },

  async invalidateProductVideos(productId: string): Promise<void> {
    if (!productId) return;
    await delMany(productVideoKeyVariants(productId));
  },

  async invalidateVideoComments(youtubeVideoId: string): Promise<void> {
    if (!youtubeVideoId) return;
    await delMany(videoCommentKeyVariants(youtubeVideoId));
  },

  async invalidateTaxonomy(category: string): Promise<void> {
    if (!category) return;
    await redisService.delete(taxonomyKey(category));
  },
};
