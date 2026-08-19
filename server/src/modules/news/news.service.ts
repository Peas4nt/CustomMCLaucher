import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateNewsDto {
  title: string;
  summary?: string;
  content: string;
  coverImage: string;
  images?: string[];
  tagId?: string | null;
  published?: boolean;
}

export interface UpdateNewsDto extends Partial<CreateNewsDto> {}

export interface CreateTagDto {
  name: string;
  color?: string;
}

export class NewsService {
  /**
   * Initialize default tags and 3 rich demo news articles if database is empty
   */
  public async ensureSeedData(): Promise<void> {
    try {
      const count = await prisma.newsArticle.count();
      if (count > 0) return;

      console.log('[NewsService] Seeding initial news and tags...');

      const updateTag = await prisma.newsTag.upsert({
        where: { slug: 'major-update' },
        update: {},
        create: {
          name: 'MAJOR UPDATE',
          slug: 'major-update',
          color: '#df9168',
        },
      });

      const eventTag = await prisma.newsTag.upsert({
        where: { slug: 'community-event' },
        update: {},
        create: {
          name: 'EVENT',
          slug: 'community-event',
          color: '#1bd96a',
        },
      });

      const patchTag = await prisma.newsTag.upsert({
        where: { slug: 'patch-notes' },
        update: {},
        create: {
          name: 'PATCH 1.4.2',
          slug: 'patch-notes',
          color: '#38bdf8',
        },
      });

      // Article 1: Season Launch & Create Modpack
      await prisma.newsArticle.create({
        data: {
          title: 'Steam & Steel: The Industrial Season Launch is Live!',
          slug: 'industrial-season-launch',
          coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
          summary: 'Explore massive kinetic automation, automated railways, and next-generation shader optimization in our biggest modpack update yet.',
          content: `## Welcome to the Industrial Age!

We are ecstatic to unveil the brand new **Industrial Season** on our servers. This update brings over **180+ custom curated mods**, complete shaderpack synchronization, and full hardware optimization.

### Key Highlights
- **Create 6.0 & Addons**: Build complex contraptions, automated trains, and kinetic networks across the whole server.
- **Distant Horizons & Shaders**: Experience unprecedented render distances with seamless shader integration without FPS drops.
- **Smart Launcher Sync**: Custom sync engine downloads mods and preserves your keybinds and configs forever.

Join our Discord to participate in the opening ceremony and claim your launch starter kit!`,
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
          ]),
          tagId: updateTag.id,
          viewsCount: 142,
          published: true,
        },
      });

      // Article 2: Grand Building Contest
      await prisma.newsArticle.create({
        data: {
          title: 'Architects of the Realm: Autumn Build Contest Announced',
          slug: 'autumn-build-contest',
          coverImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
          summary: 'Submit your steampunk and medieval monumental creations for a chance to win custom cosmetics and server perks.',
          content: `### Unleash Your Creativity

The Grand Council of Architects has officially commenced the **Autumn Build Contest**! Whether you specialize in towering gothic cathedrals, sprawling clockwork factories, or cozy rustic villages, this is your time to shine.

#### Contest Rules:
1. Builds must be created on the dedicated Creative realm or in designated survival claims.
2. Custom block palettes from Chipped, Macaw's, and Architect's Palette are encouraged!
3. Submissions close on the last Sunday of this month.

Prizes include unique launcher badges, discord roles, and in-game trophy statues!`,
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
          ]),
          tagId: eventTag.id,
          viewsCount: 89,
          published: true,
        },
      });

      // Article 3: Optimization & Security Patch
      await prisma.newsArticle.create({
        data: {
          title: 'Performance & Network Hotfix: Smooth 120 FPS Everywhere',
          slug: 'performance-hotfix-142',
          coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
          summary: 'Memory leaks resolved, memory footprints reduced by 30%, and instant server auto-reconnect implemented.',
          content: `### Patch Notes 1.4.2

Our engineering team deployed a server-wide optimization hotfix resolving client stutter and entity ticking overhead in crowded factory hubs.

#### What changed:
- **Sodium & FerriteCore Tuning**: Cut memory usage from 6GB down to 3.5GB on standard modpacks.
- **Smart Delta Hashes**: Launcher now validates mod files via dual SHA-256 + SHA-1 streams for instant zero-lag startup.
- **Enhanced Chunk Caching**: Chunk load stutter when flying with elytra is practically eliminated.`,
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
          ]),
          tagId: patchTag.id,
          viewsCount: 215,
          published: true,
        },
      });

      console.log('[NewsService] Seed complete.');
    } catch (err) {
      console.error('[NewsService] Seed error:', err);
    }
  }

  // --- News Articles ---

  public async getArticles(options?: { publishedOnly?: boolean; tagId?: string; search?: string }) {
    const where: any = {};
    if (options?.publishedOnly) {
      where.published = true;
    }
    if (options?.tagId) {
      where.tagId = options.tagId;
    }
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search } },
        { summary: { contains: options.search } },
      ];
    }

    return prisma.newsArticle.findMany({
      where,
      include: { tag: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async getArticleById(idOrSlug: string, incrementView: boolean = true) {
    const article = await prisma.newsArticle.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: { tag: true },
    });

    if (!article) return null;

    if (incrementView) {
      const updated = await prisma.newsArticle.update({
        where: { id: article.id },
        data: { viewsCount: { increment: 1 } },
        include: { tag: true },
      });
      return updated;
    }

    return article;
  }

  public async createArticle(dto: CreateNewsDto) {
    const slug = dto.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') + `-${Date.now().toString().slice(-4)}`;

    const summary = dto.summary?.trim() || '';

    return prisma.newsArticle.create({
      data: {
        title: dto.title,
        slug,
        summary,
        content: dto.content,
        coverImage: dto.coverImage,
        images: JSON.stringify(dto.images || []),
        tagId: dto.tagId || null,
        published: dto.published ?? true,
      },
      include: { tag: true },
    });
  }

  public async updateArticle(id: string, dto: UpdateNewsDto) {
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.summary !== undefined) {
      data.summary = dto.summary.trim();
    }
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage;
    if (dto.images !== undefined) data.images = JSON.stringify(dto.images);
    if (dto.tagId !== undefined) data.tagId = dto.tagId || null;
    if (dto.published !== undefined) data.published = dto.published;

    return prisma.newsArticle.update({
      where: { id },
      data,
      include: { tag: true },
    });
  }

  public async deleteArticle(id: string) {
    return prisma.newsArticle.delete({
      where: { id },
    });
  }

  // --- Tags ---

  public async getTags() {
    return prisma.newsTag.findMany({
      include: {
        _count: {
          select: { articles: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  public async createTag(dto: CreateTagDto) {
    const slug = dto.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-');

    return prisma.newsTag.create({
      data: {
        name: dto.name,
        slug,
        color: dto.color || '#df9168',
      },
    });
  }

  public async updateTag(id: string, dto: Partial<CreateTagDto>) {
    const data: any = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = dto.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-');
    }
    if (dto.color !== undefined) {
      data.color = dto.color;
    }

    return prisma.newsTag.update({
      where: { id },
      data,
    });
  }

  public async deleteTag(id: string) {
    return prisma.newsTag.delete({
      where: { id },
    });
  }
}

export const newsService = new NewsService();
