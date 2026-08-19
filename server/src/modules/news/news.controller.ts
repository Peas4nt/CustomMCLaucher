import { Request, Response } from 'express';
import { newsService } from './news.service.js';

export class NewsController {
  // --- Public Endpoints ---

  public async getPublicNews(req: Request, res: Response): Promise<void> {
    try {
      const tagId = req.query.tagId as string | undefined;
      const search = req.query.search as string | undefined;
      const articles = await newsService.getArticles({
        publishedOnly: true,
        tagId,
        search,
      });
      res.json(articles);
    } catch (error) {
      console.error('[NewsController] getPublicNews error:', error);
      res.status(500).json({ error: 'Failed to retrieve news' });
    }
  }

  public async getArticle(req: Request, res: Response): Promise<void> {
    try {
      const idOrSlug = req.params.idOrSlug;
      const increment = req.query.increment !== 'false';
      const article = await newsService.getArticleById(idOrSlug, increment);

      if (!article) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      res.json(article);
    } catch (error) {
      console.error('[NewsController] getArticle error:', error);
      res.status(500).json({ error: 'Failed to retrieve article' });
    }
  }

  public async getTags(req: Request, res: Response): Promise<void> {
    try {
      const tags = await newsService.getTags();
      res.json(tags);
    } catch (error) {
      console.error('[NewsController] getTags error:', error);
      res.status(500).json({ error: 'Failed to retrieve tags' });
    }
  }

  // --- Admin Endpoints ---

  public async getAllNewsAdmin(req: Request, res: Response): Promise<void> {
    try {
      const tagId = req.query.tagId as string | undefined;
      const search = req.query.search as string | undefined;
      const articles = await newsService.getArticles({
        publishedOnly: false,
        tagId,
        search,
      });
      res.json(articles);
    } catch (error) {
      console.error('[NewsController] getAllNewsAdmin error:', error);
      res.status(500).json({ error: 'Failed to retrieve admin news list' });
    }
  }

  public async createArticle(req: Request, res: Response): Promise<void> {
    try {
      const { title, summary, content, coverImage, images, tagId, published } = req.body;
      if (!title || !summary || !content || !coverImage) {
        res.status(400).json({ error: 'Title, summary, content, and cover image are required' });
        return;
      }

      const article = await newsService.createArticle({
        title,
        summary,
        content,
        coverImage,
        images: Array.isArray(images) ? images : [],
        tagId,
        published: published ?? true,
      });

      res.status(201).json(article);
    } catch (error) {
      console.error('[NewsController] createArticle error:', error);
      res.status(500).json({ error: 'Failed to create article' });
    }
  }

  public async updateArticle(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const { title, summary, content, coverImage, images, tagId, published } = req.body;

      const article = await newsService.updateArticle(id, {
        title,
        summary,
        content,
        coverImage,
        images: Array.isArray(images) ? images : undefined,
        tagId,
        published,
      });

      res.json(article);
    } catch (error) {
      console.error('[NewsController] updateArticle error:', error);
      res.status(500).json({ error: 'Failed to update article' });
    }
  }

  public async deleteArticle(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await newsService.deleteArticle(id);
      res.json({ message: 'Article deleted successfully' });
    } catch (error) {
      console.error('[NewsController] deleteArticle error:', error);
      res.status(500).json({ error: 'Failed to delete article' });
    }
  }

  public async createTag(req: Request, res: Response): Promise<void> {
    try {
      const { name, color } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Tag name is required' });
        return;
      }
      const tag = await newsService.createTag({ name, color });
      res.status(201).json(tag);
    } catch (error: any) {
      console.error('[NewsController] createTag error:', error);
      if (error.code === 'P2002') {
        res.status(409).json({ error: 'Tag with this name already exists' });
        return;
      }
      res.status(500).json({ error: 'Failed to create tag' });
    }
  }

  public async updateTag(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const { name, color } = req.body;
      const tag = await newsService.updateTag(id, { name, color });
      res.json(tag);
    } catch (error) {
      console.error('[NewsController] updateTag error:', error);
      res.status(500).json({ error: 'Failed to update tag' });
    }
  }

  public async deleteTag(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await newsService.deleteTag(id);
      res.json({ message: 'Tag deleted successfully' });
    } catch (error) {
      console.error('[NewsController] deleteTag error:', error);
      res.status(500).json({ error: 'Failed to delete tag' });
    }
  }
}

export const newsController = new NewsController();
